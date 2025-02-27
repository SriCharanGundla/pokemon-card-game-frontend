import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Crown, Copy } from "lucide-react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import PropTypes from "prop-types";
import CountdownTimer from "./CountdownTimer";
import PokemonCard from "./PokemonCard";

const socketUrl = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";
const socket = io(socketUrl);

const medalColors = {
  gold: {
    crown: "#FFD700",
    background: "from-yellow-100 to-yellow-50",
  },
  silver: {
    crown: "#C0C0C0",
    background: "from-gray-200 to-gray-50",
  },
  bronze: {
    crown: "#CD7F32",
    background: "from-orange-100 to-orange-50",
  },
};

const PokemonCardGen = () => {
  const [gamePhase, setGamePhase] = useState("name-entry"); // phases: name-entry, room-choice, in-room, playing
  const [gameState, setGameState] = useState({
    roomCode: "",
    players: [],
    currentRound: 1,
    currentPicker: "",
    myId: "",
    winners: [],
    selectedStat: null,
    gameSettings: {
      roundsToWin: 3,
      maxWinners: 1, // Add this new setting
    },
    gameStatus: "setup",
    gameEnded: false,
  });

  const [playerName, setPlayerName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  // const [nextRoundTimeout, setNextRoundTimeout] = useState(30);
  const [isWaitingForNextRound, setIsWaitingForNextRound] = useState(false);

  useEffect(() => {
    // Set up socket listeners
    socket.on("error", (message) => {
      toast.error(message);

      // Only go back to name-entry for errors other than "Room not found"
      if (message !== "Room not found") {
        setGamePhase("name-entry");
      }
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

    socket.on("playerReconnected", ({ players }) => {
      setGameState((state) => ({
        ...state,
        players,
      }));
      toast.success("Player reconnected");
    });

    socket.on(
      "creatorTransferred",
      ({ previousCreatorId, newCreatorId, players }) => {
        setGameState((state) => ({
          ...state,
          players,
        }));

        // Get the names for a better user message
        const previousCreator = players.find(
          (p) => p.id === previousCreatorId
        )?.name;
        const newCreator = players.find((p) => p.id === newCreatorId)?.name;

        toast.success(
          `${previousCreator} transferred admin rights to ${newCreator}`
        );
      }
    );

    // Update the playerLeft listener to handle creator reassignment
    socket.off("playerLeft"); // Remove existing listener
    socket.on("playerLeft", ({ players, leftPlayer, newCreatorId }) => {
      setGameState((state) => ({ ...state, players }));

      if (leftPlayer) {
        toast.info(`${leftPlayer.name} left the room`);
      }

      // If there was a creator change
      if (newCreatorId) {
        const newCreatorName = players.find((p) => p.id === newCreatorId)?.name;
        if (newCreatorName) {
          toast.info(`${newCreatorName} is now the admin`);
        }
      }
    });

    socket.on("roundStarted", (newGameState) => {
      setGameState((state) => ({
        ...state,
        ...newGameState,
        currentPicker: newGameState.currentPicker,
        players: newGameState.players,
        gameStatus: "playing",
        selectedStat: null,
        gameEnded: newGameState.gameEnded,
        // Remove or comment out the following line:
        // winners: [] // clear winners at new round start
      }));
      setGamePhase("playing");
      setIsWaitingForNextRound(false);
      // setNextRoundTimeout(30);
    });

    socket.on("roundComplete", ({ gameWinners, stat, players, gameEnded }) => {
      setGameState((state) => ({
        ...state,
        winners: gameWinners,
        selectedStat: stat,
        players,
        gameEnded: gameEnded,
      }));
      setIsWaitingForNextRound(true);
      // setNextRoundTimeout(30);
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

    socket.on("playerLeft", ({ players, leftPlayer }) => {
      setGameState((state) => ({ ...state, players }));

      if (leftPlayer) {
        toast.info(`${leftPlayer.name} left the room`);
      }
    });

    return () => {
      socket.off("error");
      socket.off("connect");
      socket.off("roomCreated");
      socket.off("playerJoined");
      socket.off("playerReconnected");
      socket.off("creatorTransferred");
      socket.off("roundStarted");
      socket.off("roundComplete");
      socket.off("gameReset");
      socket.off("playerLeft");
      socket.off("gameStateUpdate");
    };
  }, []);

  // useEffect(() => {
  //   let intervalId;
  //   if (isWaitingForNextRound) {
  //     intervalId = setInterval(() => {
  //       setNextRoundTimeout((prev) => {
  //         if (prev <= 1) {
  //           setIsWaitingForNextRound(false);
  //           return 30;
  //         }
  //         return prev - 1;
  //       });
  //     }, 1000);
  //   }
  //   return () => {
  //     if (intervalId) clearInterval(intervalId);
  //   };
  // }, [isWaitingForNextRound]);

  useEffect(() => {
    socket.on("playerStatusUpdate", ({ id, isBackInRoom }) => {
      setGameState((state) => ({
        ...state,
        players: state.players.map((player) =>
          player.id === id ? { ...player, isBackInRoom } : player
        ),
      }));
    });

    return () => {
      socket.off("playerStatusUpdate");
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

    // Simply move to room choice since we'll check the name when joining/creating rooms
    setGamePhase("room-choice");
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
      gameEnded: false, // Explicitly reset gameEnded
      gameSettings: {
        roundsToWin: 3,
        maxWinners: 1,
      },
    }));
    setGamePhase("room-choice");
  };

  const goBackToRoom = () => {
    // Let the server know we’re back
    socket.emit("playerBackToRoom", {
      roomCode: gameState.roomCode,
    });
    // Locally reset some things
    resetGameState();
    // Optionally set the local phase; or rely on the server’s gameStateUpdate
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

  const updateGameSettings = (setting, value) => {
    setGameState((state) => ({
      ...state,
      gameSettings: { ...state.gameSettings, [setting]: value },
    }));
    socket.emit("updateSettings", {
      roomCode: gameState.roomCode,
      settings: { [setting]: value },
    });
  };

  const transferAdmin = (newAdminId) => {
    socket.emit("transferCreator", {
      roomCode: gameState.roomCode,
      newCreatorId: newAdminId,
    });
  };

  // Separate controlled input handlers
  const handleNameChange = (e) => {
    e.preventDefault(); // Prevent any default browser behavior
    const value = e.target.value;
    if (value.length <= 20) {
      // Handle max length in the handler
      setPlayerName(value);
    }
  };

  const handleJoinCodeChange = (e) => {
    e.preventDefault();
    const value = e.target.value.toUpperCase();
    setJoinCode(value);
  };

  const resetGameState = () => {
    setGameState((state) => ({
      ...state,
      currentRound: 1,
      currentPicker: "",
      winners: [],
      selectedStat: null,
      gameStatus: "setup",
      gameEnded: false,
      players: state.players.map((player) => ({
        ...player,
        score: 0,
        pokemon: null,
      })),
    }));
  };

  // Modified PageContainer to take full width/height on all device sizes
  const PageContainer = ({ children, className = "" }) => (
    <div
      className={`fixed inset-0 bg-gradient-to-b from-red-600 to-red-700 flex items-center justify-center ${className} overflow-y-auto`}
    >
      <div className="w-full max-w-md">{children}</div>
    </div>
  );

  // Added propTypes for PageContainer
  PageContainer.propTypes = {
    children: PropTypes.node.isRequired,
    className: PropTypes.string,
  };

  // Modified player display component
  const PlayerScore = ({ player, winnerRank }) => {
    let medalStyle = null;
    if (winnerRank === 0) {
      medalStyle = medalColors.gold;
    } else if (winnerRank === 1) {
      medalStyle = medalColors.silver;
    } else if (winnerRank === 2) {
      medalStyle = medalColors.bronze;
    }

    return (
      <div className="text-center mb-6">
        <div
          className={`rounded-xl px-4 py-2 ${
            medalStyle
              ? `bg-gradient-to-r ${medalStyle.background}`
              : "bg-gradient-to-r from-gray-50 to-white"
          }`}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            {medalStyle && (
              <Crown
                className={`h-5 w-5`}
                style={{ color: medalStyle.crown }}
              />
            )}
            <span className="text-xl font-bold text-gray-800">
              {player.name}
            </span>
          </div>
          <div className="text-sm font-medium text-gray-600">
            Score: {player.score}
          </div>
        </div>
      </div>
    );
  };

  // Update PropTypes
  PlayerScore.propTypes = {
    player: PropTypes.shape({
      name: PropTypes.string.isRequired,
      score: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
        .isRequired,
    }).isRequired,
    winnerRank: PropTypes.number,
  };

  // ---------- Render Phases ----------

  // 1. Name Entry Phase
  if (gamePhase === "name-entry") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-red-600 to-red-700 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img
              src="/logo.png"
              alt="Pokemon Logo"
              className="mx-auto mb-4 h-32"
            />
          </div>

          <div className="bg-white rounded-lg shadow-2xl p-8 transform hover:scale-105 transition-transform duration-300">
            <form onSubmit={handleNameSubmit} className="space-y-6">
              <div className="relative">
                <img
                  src="/pokeball.png"
                  alt="Pokeball"
                  className="mx-auto mb-4 h-10 w-10 animate-spin-slow"
                />
                <h2 className="text-2xl font-bold text-center mt-4 mb-6">
                  Choose Your Trainer Name!
                </h2>
                <div className="relative">
                  <input
                    type="text"
                    value={playerName}
                    onChange={handleNameChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:ring focus:ring-red-200 transition-colors duration-200"
                    placeholder="Enter your name"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                    {playerName.length}/20
                  </div>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-lg transform hover:scale-105 transition-all duration-200 font-bold text-lg"
              >
                Start Your Journey!
              </Button>
            </form>
          </div>
          <div className="mt-6 text-center">
            <p className="text-white text-sm">
              Ready to become a Pokémon Master?
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Room Choice Phase
  if (gamePhase === "room-choice") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-red-600 to-red-700 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-2xl p-8">
            <div className="text-center mb-6">
              <img
                src="/pokeball.png"
                alt="Pokeball"
                className="mx-auto mb-4 h-10 w-10 animate-spin-slow"
              />
              <h2 className="text-2xl font-bold">
                Welcome, Trainer {playerName}!
              </h2>
              <p className="text-gray-600 mt-2">Choose your next move</p>
            </div>

            <div className="space-y-6">
              <Button
                onClick={createRoom}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-lg transform hover:scale-105 transition-all duration-200 font-bold"
              >
                Create New Battle Room
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">OR</span>
                </div>
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  value={joinCode}
                  onChange={handleJoinCodeChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:ring focus:ring-red-200 transition-colors duration-200"
                  placeholder="Enter room code"
                />
                <Button
                  onClick={joinRoom}
                  className="w-full bg-black hover:bg-gray-800 text-white py-4 rounded-lg transform hover:scale-105 transition-all duration-200 font-bold"
                >
                  Join Battle Room
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. In-Room Phase (Waiting Room)
  if (gamePhase === "in-room") {
    const isCreator = gameState.players.find(
      (p) => p.id === gameState.myId
    )?.isCreator;
    const playerCount = gameState.players.length;
    const maxAllowedWinners = Math.min(playerCount - 1, 3);

    const allPlayersAreBack = gameState.players.every((p) => p.isBackInRoom);

    return (
      <PageContainer>
        <div className="min-h-screen py-10 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="text-center mb-6 flex flex-col justify-center items-center">
              <img
                src="/pokeball.png"
                alt="Pokeball"
                className="mx-auto mb-4 h-10 w-10 animate-spin-slow"
              />
              <h2 className="text-2xl font-bold mb-2">Battle Room</h2>
              <div className="flex items-center justify-center gap-2 bg-gray-100 py-2 px-4 rounded-lg mx-6 w-fit">
                <span className="font-medium">
                  Room Code: {gameState.roomCode}
                </span>
                <Button
                  onClick={copyRoomCode}
                  variant="outline"
                  size="icon"
                  className="hover:bg-gray-200 h-7 w-7"
                >
                  <Copy className="h-4 w-4 text-white" />
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-lg mb-3">Trainers:</h3>
                <div className="space-y-2">
                  {gameState.players.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between gap-2 py-3 px-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src="/trainer.png"
                          alt="Trainer"
                          className="w-8 h-8"
                        />
                        <span className="font-medium">{player.name}</span>
                        {!player.isBackInRoom && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                            Still in last game...
                          </span>
                        )}
                      </div>
                      {player.isCreator && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                          Gym Leader
                        </span>
                      )}
                      {/* Add admin transfer button */}
                      {isCreator && player.id !== gameState.myId && (
                        <Button
                          onClick={() => transferAdmin(player.id)}
                          size="icon"
                          variant="outline"
                          className="p-2 rounded-full text-white hover:text-gray-300"
                          title="Transfer Admin Privileges"
                        >
                          <Crown className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {isCreator && gameState.players.length > 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Rounds to Win Championship:
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={gameState.gameSettings.roundsToWin}
                      onChange={(e) => {
                        const value = Math.max(
                          1,
                          Math.min(10, parseInt(e.target.value) || 1)
                        );
                        updateRoundsToWin({ target: { value } });
                      }}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:ring focus:ring-red-200 transition-colors duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Number of Winners (max {maxAllowedWinners}):
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={maxAllowedWinners}
                      value={Math.min(
                        gameState.gameSettings.maxWinners,
                        maxAllowedWinners
                      )}
                      onChange={(e) => {
                        const value = Math.max(
                          1,
                          Math.min(
                            maxAllowedWinners,
                            parseInt(e.target.value) || 1
                          )
                        );
                        updateGameSettings("maxWinners", value);
                      }}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:ring focus:ring-red-200 transition-colors duration-200"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Maximum winners is limited by player count
                    </p>
                  </div>
                  <Button
                    onClick={startGame}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-lg ..."
                    disabled={!allPlayersAreBack} // Disable if not all back
                  >
                    Start Battle!
                  </Button>
                </div>
              )}

              <Button
                onClick={handleLeaveRoom}
                variant="destructive"
                className="w-full py-4 rounded-lg transform hover:scale-105 transition-all duration-200 font-bold"
              >
                Leave Room
              </Button>
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  // 4. Playing Phase - Completely revised for full screen layout
  if (gamePhase === "playing") {
    const gameOver = gameState.gameEnded;
    const inTieBreaker = gameState.inTieBreaker;

    return (
      <div className="fixed inset-0 bg-gradient-to-b from-red-600 to-red-700 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto py-1 px-6">
          <div className="bg-white rounded-lg shadow-2xl p-6 mb-8">
            <div className="text-center mb-6">
              <img
                src="/pokeball.png"
                alt="Pokeball"
                className="mx-auto mb-4 h-10 w-10 animate-spin-slow"
              />
              <div className="text-2xl font-bold mb-2">
                {gameOver
                  ? "Game Over!"
                  : inTieBreaker
                  ? "Tie Breaker!"
                  : `Round ${gameState.currentRound}`}
              </div>
              {!gameOver && (
                <div className="text-gray-600">
                  {inTieBreaker ? (
                    <span>Tie breaker in progress for tied players...</span>
                  ) : gameState.currentPicker === gameState.myId ? (
                    "You're the picker! Select a stat to battle with."
                  ) : (
                    `Waiting for ${
                      gameState.players.find(
                        (p) => p.id === gameState.currentPicker
                      )?.name || "next player"
                    } to choose...`
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-8 justify-center">
              {gameState.players.map((player) => {
                const isMyCard = player.id === gameState.myId;
                const isPickerCard = player.id === gameState.currentPicker;
                // Only show full opacity if the card belongs to the current user or the picker.
                const isRevealed =
                  player.id === gameState.myId ||
                  gameState.selectedStat ||
                  gameOver ||
                  gameState.winners.includes(player.id);

                const cardOpacity =
                  isMyCard || isPickerCard || isRevealed
                    ? "opacity-100"
                    : "opacity-50";

                return (
                  <div key={player.id} className={`text-center ${cardOpacity}`}>
                    <PlayerScore
                      player={player}
                      winnerRank={
                        gameState.winners.indexOf(player.id) !== -1
                          ? gameState.winners.indexOf(player.id)
                          : undefined
                      }
                    />
                    <PokemonCard
                      pokemon={player.pokemon}
                      isRevealed={isRevealed}
                      isPicker={
                        player.id === gameState.currentPicker &&
                        !gameState.winners.includes(player.id)
                      }
                      selectedStat={gameState.selectedStat}
                      onStatSelect={handleStatSelect}
                      isWinner={gameState.winners.includes(player.id)}
                      gameOver={gameOver}
                    />
                  </div>
                );
              })}
            </div>

            {isWaitingForNextRound && !gameOver && (
              <div className="mt-4 text-center">
                {gameState.currentPicker === gameState.myId ? (
                  <Button
                    onClick={() => {
                      socket.emit("nextRound", {
                        roomCode: gameState.roomCode,
                      });
                    }}
                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
                  >
                    Next Round (
                    <CountdownTimer
                      initialCount={30}
                      onComplete={() => setIsWaitingForNextRound(false)}
                    />
                    s)
                  </Button>
                ) : (
                  <p className="text-white">
                    Next round starting in{" "}
                    <CountdownTimer
                      initialCount={30}
                      onComplete={() => setIsWaitingForNextRound(false)}
                    />{" "}
                    seconds...
                  </p>
                )}
              </div>
            )}

            {gameOver && (
              <div className="flex gap-4 justify-center mt-8">
                <Button
                  onClick={goBackToRoom}
                  className="bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-lg transform hover:scale-105 transition-all duration-200 font-bold"
                >
                  Back to Battle Room
                </Button>
                <Button
                  onClick={handleLeaveRoom}
                  className="bg-black hover:bg-gray-800 text-white py-3 px-6 rounded-lg transform hover:scale-105 transition-all duration-200 font-bold"
                >
                  Leave Battle
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
};

export default PokemonCardGen;
