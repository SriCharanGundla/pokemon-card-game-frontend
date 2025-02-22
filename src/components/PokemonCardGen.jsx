import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Copy } from "lucide-react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import PropTypes from "prop-types";

const socketUrl = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";
const socket = io(socketUrl);

const PokemonCardPropTypes = {
  pokemon: PropTypes.shape({
    name: PropTypes.string.isRequired,
    sprite: PropTypes.string.isRequired,
    hp: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    stats: PropTypes.shape({
      attack: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
        .isRequired,
      defense: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
        .isRequired,
      speed: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
        .isRequired,
    }).isRequired,
  }).isRequired,
  isRevealed: PropTypes.bool.isRequired,
  isPicker: PropTypes.bool.isRequired,
};

const PokemonCardGen = () => {
  const [gamePhase, setGamePhase] = useState("name-entry"); // phases: name-entry, room-choice, in-room, playing
  const [gameState, setGameState] = useState({
    roomCode: "",
    players: [],
    currentRound: 1,
    currentPicker: "",
    myId: "",
    winners: [], // non-empty means the game is over
    selectedStat: null,
    // The rounds-to-win setting is configurable by the admin in the waiting room
    gameSettings: {
      roundsToWin: 3,
    },
    gameStatus: "setup", // setup, playing
  });

  const [playerName, setPlayerName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    // Set up socket listeners
    socket.on("error", (message) => {
      toast.error(message);
      setGamePhase("name-entry");
    });

    socket.on("connect", () => {
      setGameState((state) => ({ ...state, myId: socket.id }));
    });

    socket.on("roomCreated", ({ roomCode, players }) => {
      setGameState((state) => ({
        ...state,
        roomCode,
        players,
      }));
      setGamePhase("in-room");
      toast.success("Room Created! Share code: " + roomCode);
    });

    socket.on("gameStateUpdate", ({ roomCode, players, phase }) => {
      setGameState((state) => ({
        ...state,
        roomCode,
        players,
      }));
      setGamePhase(phase);
    });

    socket.on("playerJoined", ({ players }) => {
      setGameState((state) => ({ ...state, players }));
      setGamePhase("in-room");
      const newPlayer = players[players.length - 1];
      toast.success(`${newPlayer.name} joined the room`);
    });

    socket.on("roundStarted", (newGameState) => {
      setGameState((state) => ({
        ...state,
        ...newGameState,
        currentPicker: newGameState.currentPicker,
        players: newGameState.players,
        gameStatus: "playing",
        selectedStat: null,
        winners: [], // clear winners at new round start
      }));
      setGamePhase("playing");
    });

    socket.on("roundComplete", ({ gameWinners, stat, players }) => {
      // Update state with fresh scores and winner info.
      setGameState((state) => ({
        ...state,
        winners: gameWinners,
        selectedStat: stat,
        players,
      }));
      // Do not change phase here—instead, the playing view will now show the end-of-match options.
    });

    socket.on("gameReset", () => {
      setGameState((state) => ({
        ...state,
        winners: [],
        currentRound: 0,
        selectedStat: null,
        gameStatus: "playing",
      }));
    });

    socket.on("playerLeft", ({ players }) => {
      setGameState((state) => ({ ...state, players }));
    });

    return () => {
      socket.off("error");
      socket.off("connect");
      socket.off("roomCreated");
      socket.off("playerJoined");
      socket.off("roundStarted");
      socket.off("roundComplete");
      socket.off("gameReset");
      socket.off("playerLeft");
      socket.off("gameStateUpdate");
    };
  }, []);

  const handleNameSubmit = (e) => {
    e.preventDefault();
    const trimmedName = playerName.trim();
    if (!trimmedName) {
      toast.error("Please enter your name");
      return;
    }
    if (!socket.connected) {
      toast.error("Connecting to server... please wait");
      return;
    }
    socket.emit("checkName", trimmedName, (exists) => {
      if (exists) {
        toast.error("This name is already taken");
        return;
      } else {
        socket.emit("addName", trimmedName, () => {
          setGamePhase("room-choice");
        });
      }
    });
  };

  const createRoom = () => {
    // Use the current gameSettings from state
    socket.emit("createRoom", {
      playerName,
      settings: gameState.gameSettings,
    });
  };

  const joinRoom = () => {
    if (!joinCode) {
      toast.error("Please enter a room code");
      return;
    }
    socket.emit("joinRoom", {
      roomCode: joinCode,
      playerName,
    });
  };

  const startGame = () => {
    socket.emit("startGame", {
      roomCode: gameState.roomCode,
    });
  };

  const handleStatSelect = (stat) => {
    if (gameState.currentPicker === gameState.myId && !gameState.selectedStat) {
      socket.emit("selectStat", {
        roomCode: gameState.roomCode,
        stat,
      });
    }
  };

  const handleLeaveRoom = () => {
    socket.emit("leaveRoom", {
      roomCode: gameState.roomCode,
    });
    setGameState((state) => ({
      ...state,
      roomCode: "",
      players: [],
      currentRound: 0,
      currentPicker: "",
      myId: socket.id,
      gameStatus: "setup",
      winners: [],
      selectedStat: null,
      gameSettings: {
        roundsToWin: 3,
      },
    }));
    setGamePhase("room-choice");
  };

  const goBackToRoom = () => {
    // Return to waiting room without leaving
    setGamePhase("in-room");
  };

  const updateRoundsToWin = (e) => {
    const newValue = parseInt(e.target.value) || 1;
    setGameState((state) => ({
      ...state,
      gameSettings: { ...state.gameSettings, roundsToWin: newValue },
    }));
    // Emit updateSettings so that backend game room is updated accordingly.
    socket.emit("updateSettings", {
      roomCode: gameState.roomCode,
      settings: { roundsToWin: newValue },
    });
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(gameState.roomCode);
    toast("Room code copied to clipboard");
  };

  // In the playing phase, cards are revealed if a stat is selected or if winners exist.
  const PokemonCard = ({ pokemon, isRevealed, isPicker }) => {
    if (!pokemon) return null;
    const displayPokemon = isRevealed
      ? pokemon
      : {
          ...pokemon,
          sprite: "/card-back.png",
          name: "???",
          hp: "?",
          stats: { attack: "?", defense: "?", speed: "?" },
        };
    return (
      <Card className="w-64 bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="relative">
          <div className="absolute top-2 right-2 bg-white rounded-full px-2 py-1 text-sm">
            HP {displayPokemon.hp}
          </div>
          <img
            src={displayPokemon.sprite}
            alt={displayPokemon.name}
            className="w-full h-48 object-contain bg-gray-100"
          />
        </div>
        <CardHeader className="text-xl font-bold text-center capitalize">
          {displayPokemon.name}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: "hp", label: "HP", value: displayPokemon.hp },
              {
                key: "attack",
                label: "ATK",
                value: displayPokemon.stats.attack,
              },
              {
                key: "defense",
                label: "DEF",
                value: displayPokemon.stats.defense,
              },
              { key: "speed", label: "SPD", value: displayPokemon.stats.speed },
            ].map(({ key, label, value }) => (
              <Button
                key={key}
                onClick={() => handleStatSelect(key)}
                disabled={!isPicker || gameState.selectedStat}
                className={`p-3 rounded-md w-full ${
                  gameState.selectedStat === key
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-white"
                }`}
              >
                <div className="text-xl font-bold">{value}</div>
                <div className="text-sm">{label}</div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  PokemonCard.propTypes = PokemonCardPropTypes;

  // ---------- Render Phases ----------

  // 1. Name Entry Phase
  if (gamePhase === "name-entry") {
    return (
      <div className="container mx-auto p-4 max-w-md">
        <Card className="p-6">
          <CardHeader>
            <h2 className="text-2xl font-bold text-center">
              Welcome to Pokémon Stat Battle
            </h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleNameSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Enter your name"
                />
              </div>
              <Button type="submit" className="w-full">
                Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. Room Choice Phase
  if (gamePhase === "room-choice") {
    return (
      <div className="container mx-auto p-4 max-w-md">
        <Card className="p-6">
          <CardHeader>
            <h2 className="text-2xl font-bold text-center">Hi {playerName}!</h2>
            <p className="text-center text-gray-600">
              Choose an option to play
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={createRoom} className="w-full">
              Create New Room
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">OR</span>
              </div>
            </div>
            <div className="space-y-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="w-full p-2 border rounded"
                placeholder="Enter room code"
              />
              <Button onClick={joinRoom} className="w-full">
                Join Room
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 3. In-Room Phase (Waiting Room)
  if (gamePhase === "in-room") {
    const isCreator = gameState.players.find(
      (p) => p.id === gameState.myId
    )?.isCreator;
    return (
      <div className="container mx-auto p-4 text-center">
        <Card className="p-6">
          <CardHeader>
            <h2 className="text-2xl font-bold">
              Welcome to Room {gameState.roomCode}
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              <span>Room Code: {gameState.roomCode}</span>
              <Button onClick={copyRoomCode} variant="outline" size="icon">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium">Players:</h3>
              {gameState.players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between py-2 px-4 bg-gray-50 rounded"
                >
                  <div className="flex items-center gap-2">
                    <span>{player.name}</span>
                    {player.isCreator && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Admin
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Admin can update rounds-to-win and start game; also all can leave */}
            <div className="flex flex-col gap-4">
              {isCreator && gameState.players.length > 1 && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Rounds to Win:
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={gameState.gameSettings.roundsToWin}
                      onChange={updateRoundsToWin}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <Button onClick={startGame} className="w-full">
                    Start Game
                  </Button>
                </>
              )}
              <Button onClick={handleLeaveRoom} variant="destructive">
                Leave Room
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 4. Playing Phase (Integrated End-of-Match Display)
  // In this view, if gameState.winners is non-empty, all cards are revealed and the winning card(s)
  // are highlighted. Additionally, two buttons are shown at the bottom: one to go back to room (waiting room)
  // and one to leave the room.
  if (gamePhase === "playing") {
    // gameEnded is true if any player's score is >= roundsToWin.
    const gameEnded = gameState.players.some(
      (p) => p.score >= gameState.gameSettings.roundsToWin
    );

    return (
      <div className="container mx-auto p-4">
        <div className="text-center mb-4">
          <div className="text-xl font-bold">
            Round {gameState.currentRound}
          </div>
          <div className="text-gray-600">
            {gameState.currentPicker === gameState.myId
              ? "You're the picker! Select a stat."
              : `Waiting for ${
                  gameState.players.find(
                    (p) => p.id === gameState.currentPicker
                  )?.name || "next player"
                } to pick...`}
          </div>
        </div>

        <div className="flex flex-wrap gap-8 justify-center">
          {gameState.players.map((player) => (
            <div key={player.id} className="text-center">
              <div
                className={`mb-2 ${
                  gameEnded &&
                  player.score >= gameState.gameSettings.roundsToWin
                    ? "font-bold"
                    : ""
                }`}
              >
                {player.name} (Score: {player.score})
                {gameEnded &&
                  player.score >= gameState.gameSettings.roundsToWin && (
                    <Crown className="inline ml-2 text-yellow-500" />
                  )}
              </div>
              <PokemonCard
                pokemon={player.pokemon}
                // Reveal card if it's your own, a stat was selected, or the game has ended
                isRevealed={
                  player.id === gameState.myId ||
                  gameState.selectedStat ||
                  gameEnded
                }
                isPicker={player.id === gameState.currentPicker}
              />
            </div>
          ))}
        </div>

        {/* When the game is over, show options to return to room or leave */}
        {gameEnded && (
          <div className="flex gap-4 justify-center mt-8">
            <Button onClick={goBackToRoom}>Go Back to Room</Button>
            <Button onClick={handleLeaveRoom} variant="destructive">
              Leave Room
            </Button>
          </div>
        )}
      </div>
    );
  }
};

export default PokemonCardGen;
