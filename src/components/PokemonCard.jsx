import PropTypes from "prop-types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Assume typeColors and medalColors are defined or imported in your project.
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
  selectedStat: PropTypes.string, // stat selected by the picker
  onStatSelect: PropTypes.func,
  isWinner: PropTypes.bool,
  gameOver: PropTypes.bool,
};

// Add Pokemon type colors
const typeColors = {
  normal: "#A8A878",
  fire: "#F08030",
  water: "#6890F0",
  electric: "#F8D030",
  grass: "#78C850",
  ice: "#98D8D8",
  fighting: "#C03028",
  poison: "#A040A0",
  ground: "#E0C068",
  flying: "#A890F0",
  psychic: "#F85888",
  bug: "#A8B820",
  rock: "#B8A038",
  ghost: "#705898",
  dragon: "#7038F8",
  dark: "#705848",
  steel: "#B8B8D0",
  fairy: "#EE99AC",
};

const PokemonCard = ({
  pokemon,
  isRevealed,
  isPicker,
  selectedStat,
  onStatSelect,
  isWinner,
  gameOver,
}) => {
  if (!pokemon) return null;

  // If not revealed, show placeholder data.
  const hiddenPokemon = {
    ...pokemon,
    sprite: "/pokeball.png",
    name: "???",
    hp: "?",
    stats: { attack: "?", defense: "?", speed: "?" },
    type: "normal",
  };

  const displayPokemon = isRevealed ? pokemon : hiddenPokemon;

  return (
    <div className={`flip-card ${isRevealed ? "flipped" : ""}`}>
      <div className="flip-card-inner">
        {/* Front Side: Unrevealed */}
        <div className="flip-card-front">
          <Card className="w-72 bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="relative h-48 flex items-center justify-center">
              <img
                src="/pokeball.png"
                alt="Pokeball"
                className="h-40 object-cover opacity-70 mt-12"
              />
            </div>
            <CardHeader className="text-xl font-bold text-center capitalize py-2 bg-gradient-to-r from-gray-50 to-white">
              ???
            </CardHeader>
            <CardContent className="p-4 py-0">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "hp", label: "HP", value: "?" },
                  { key: "attack", label: "ATK", value: "?" },
                  { key: "defense", label: "DEF", value: "?" },
                  { key: "speed", label: "SPD", value: "?" },
                ].map(({ key, label, value }) => (
                  <Button
                    key={key}
                    className="relative transition-all duration-200 shadow"
                    style={{ backgroundColor: "white" }}
                  >
                    <div className="text-xl font-bold text-black">{value}</div>
                    <div className="text-sm text-black">{label}</div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Back Side: Revealed */}
        <div className="flip-card-back">
          <Card className="w-72 bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="relative">
              <div
                className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full opacity-30"
                style={{
                  backgroundColor:
                    typeColors[displayPokemon.type?.toLowerCase() || "normal"],
                }}
              />
              <div className="relative h-48 flex items-center justify-center">
                <img
                  src={displayPokemon.sprite}
                  alt={displayPokemon.name}
                  className="h-40 object-contain"
                />
              </div>
            </div>
            <CardHeader className="text-xl font-bold text-center capitalize py-2 bg-gradient-to-r from-gray-50 to-white">
              {displayPokemon.name}
            </CardHeader>
            <CardContent className="p-4 py-0">
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    key: "hp",
                    label: "HP",
                    value: displayPokemon.hp,
                  },
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
                  {
                    key: "speed",
                    label: "SPD",
                    value: displayPokemon.stats.speed,
                  },
                ].map(({ key, label, value }) => (
                  <Button
                    key={key}
                    onClick={() => onStatSelect && onStatSelect(key)}
                    disabled={!isPicker || selectedStat}
                    className={`relative transition-all duration-200 shadow ${
                      !isWinner && selectedStat === key && !gameOver
                        ? "highlighted-stat"
                        : ""
                    }`}
                    style={{ backgroundColor: "white" }}
                  >
                    <div className="text-xl font-bold text-black">{value}</div>
                    <div className="text-sm text-black">{label}</div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

PokemonCard.propTypes = PokemonCardPropTypes;
export default PokemonCard;
