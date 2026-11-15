(function () {
  "use strict";
  const game = window.gagunBomberman = window.gagunBomberman || {};
  const textureRoot = "assets/bomberman/textures";

  // Replace these paths with your own SVG, PNG or WebP files; rules are independent of artwork.
  function textures(theme) {
    return {
      floor: `${textureRoot}/${theme}/floor.svg`,
      wall: `${textureRoot}/${theme}/wall.svg`,
      crate: `${textureRoot}/${theme}/crate.svg`,
      bomb: `${textureRoot}/${theme}/bomb.svg`,
      players: [1, 2, 3, 4].map(id => `${textureRoot}/${theme}/player-${id}.svg`),
    };
  }
  game.themes = {
    garden: { label: "Pocket garden", textures: textures("garden"), shadow: "#597660", fire: "#ffb34d", fireCore: "#fff5a9", accent: "#e9a152" },
    arcade: { label: "Neon arcade", textures: textures("arcade"), shadow: "#070c21", fire: "#f37cbb", fireCore: "#fff4bd", accent: "#58ddcf" },
    toy: { label: "Toy box", textures: textures("toy"), shadow: "#667b8c", fire: "#ffab69", fireCore: "#fff7c7", accent: "#e9a152" },
  };
  game.itemTextures = Object.fromEntries(["flame", "bomb", "speed", "shield"].map(type => [type, `${textureRoot}/items/${type}.svg`]));
  // WAV, MP3 and OGG files are supported. Each effect has one replaceable file.
  game.sounds = Object.fromEntries(["join", "countdown", "start", "place", "explosion", "pickup", "elimination", "shield", "victory", "draw"]
    .map(name => [name, `assets/bomberman/audio/${name}.wav`]));
}());
