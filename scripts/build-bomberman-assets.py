"""Rebuild the original, replaceable Bomberman SVG textures and WAV effects."""

from pathlib import Path
import math
import random
import struct
import wave

ROOT = Path(__file__).resolve().parents[1] / "assets" / "bomberman"
COLORS = ["#29b7cc", "#efa83a", "#ab89ef", "#57c888"]


def svg(body, size=64):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 64 64">{body}</svg>\n'


def write(theme, name, body):
    folder = ROOT / "textures" / theme
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{name}.svg").write_text(svg(body), encoding="utf-8")


def build_textures():
    write("garden", "floor", '''
      <rect width="64" height="64" fill="#d6e3c1"/>
      <path d="M0 63.5H64M63.5 0V64" stroke="#c9d8b3"/>
      <path d="M12 14l2-4 2 4m30 30 2-4 2 4M23 48l1-3 2 3" fill="none" stroke="#b9cc9f" stroke-width="1.2" stroke-linecap="round"/>
      <circle cx="49" cy="13" r="1" fill="#eff3d7"/>
    ''')
    write("garden", "wall", '''
      <rect x="3" y="8" width="58" height="54" rx="9" fill="#4b6260" opacity=".24"/>
      <rect x="3" y="3" width="58" height="53" rx="8" fill="#879a90"/>
      <rect x="5" y="3" width="54" height="44" rx="7" fill="#b2bfb0"/>
      <path d="M12 9H52M9 15V35" stroke="#d2daca" stroke-width="3" stroke-linecap="round"/>
      <path d="M23 48h23m-31 2h3" stroke="#6f867b" stroke-width="2" stroke-linecap="round"/>
      <path d="M48 43c-7-2-11 0-12 5 8 1 12-1 12-5" fill="#7d9b69"/>
    ''')
    write("garden", "crate", '''
      <rect x="4" y="11" width="56" height="49" rx="6" fill="#745044" opacity=".22"/>
      <rect x="3" y="6" width="58" height="49" rx="5" fill="#aa6551"/>
      <rect x="3" y="4" width="58" height="44" rx="5" fill="#d28c6c"/>
      <path d="M4 19H60M4 34H60M23 5V18M44 20V33M22 35V47" stroke="#ad6c54" stroke-width="2"/>
      <path d="M8 8H18M28 8H53M9 23H35M9 38H17M28 38H53" stroke="#e9af88" stroke-width="2" stroke-linecap="round"/>
      <path d="M39 7l-5 6 5 6-6 6" fill="none" stroke="#9c5e4f" stroke-width="1.5"/>
    ''')
    write("arcade", "floor", '''
      <rect width="64" height="64" fill="#172038"/>
      <rect x="1" y="1" width="62" height="62" rx="4" fill="#1b2742" stroke="#253251"/>
      <path d="M8 14V8h6M50 56h6v-6" fill="none" stroke="#334468" stroke-width="1.2"/>
      <circle cx="32" cy="32" r="1" fill="#344361"/>
    ''')
    write("arcade", "wall", '''
      <rect x="3" y="7" width="58" height="54" rx="6" fill="#0a0f24"/>
      <rect x="3" y="3" width="58" height="52" rx="5" fill="#373762" stroke="#6c6aad" stroke-width="2"/>
      <rect x="8" y="7" width="48" height="41" rx="3" fill="#454675" stroke="#7978b0"/>
      <path d="M12 12H28M12 16H22M42 42H52" stroke="#aaa1f4" stroke-width="2"/>
      <path d="M14 56H50" stroke="#8271f0" stroke-width="2"/>
      <path d="M49 14v11h-6V14z" fill="#9c89fa" opacity=".25"/>
    ''')
    write("arcade", "crate", '''
      <rect x="4" y="9" width="56" height="51" rx="5" fill="#050b20"/>
      <rect x="4" y="4" width="56" height="49" rx="4" fill="#66365d" stroke="#d06c9f" stroke-width="2"/>
      <rect x="9" y="9" width="46" height="37" rx="2" fill="#85416e" stroke="#a85a89"/>
      <path d="M10 10l44 35m0-35L10 45" stroke="#c573a1" stroke-width="3"/>
      <path d="M7 6h15M7 8h10M42 50h13" stroke="#f6a7cb" stroke-width="2"/>
      <path d="M24 26l8-12 8 12-8 12z" fill="#d882b3"/>
      <path d="M32 19v9m0 4v1" stroke="#552849" stroke-width="2"/>
    ''')
    write("toy", "floor", '''
      <rect width="64" height="64" fill="#d5e8df"/>
      <rect x="2" y="2" width="60" height="60" rx="9" fill="#e0eee6"/>
      <path d="M16 33h4m24-1h4" stroke="#c9ddd3" stroke-width="2" stroke-linecap="round"/>
    ''')
    write("toy", "wall", '''
      <rect x="3" y="10" width="58" height="51" rx="9" fill="#364b88" opacity=".2"/>
      <rect x="3" y="5" width="58" height="52" rx="8" fill="#527cc1"/>
      <rect x="3" y="3" width="58" height="45" rx="8" fill="#7a9cd6"/>
      <path d="M12 7H51" stroke="#a3bdeb" stroke-width="3" stroke-linecap="round"/>
      <g fill="#6588c5" stroke="#8fafe1" stroke-width="2">
        <ellipse cx="20" cy="19" rx="7" ry="6"/><ellipse cx="44" cy="19" rx="7" ry="6"/>
        <ellipse cx="20" cy="36" rx="7" ry="6"/><ellipse cx="44" cy="36" rx="7" ry="6"/>
      </g>
    ''')
    write("toy", "crate", '''
      <rect x="4" y="11" width="56" height="48" rx="6" fill="#9d7656" opacity=".2"/>
      <rect x="4" y="5" width="56" height="49" rx="6" fill="#bc855e"/>
      <rect x="4" y="3" width="56" height="43" rx="6" fill="#e0b582"/>
      <path d="M7 7l49 35m0-35L7 42" stroke="#f6d6a5" stroke-width="8"/>
      <rect x="23" y="17" width="19" height="15" rx="3" fill="#f9e5bf" transform="rotate(-9 32 24)"/>
      <path d="M29 27V21l7 3z" fill="#bd9164"/>
      <path d="M11 49h10m27 0h6" stroke="#a96e48" stroke-width="2"/>
    ''')
    for theme in ["garden", "arcade", "toy"]:
      dark = "#202c42" if theme != "arcade" else "#3e4a70"
      fuse = "#f7b64d" if theme != "arcade" else "#50f1e0"
      write(theme, "bomb", f'''
        <ellipse cx="31" cy="53" rx="21" ry="6" fill="#111c2d" opacity=".17"/>
        <path d="M36 19c0-7 5-8 8-10" fill="none" stroke="{fuse}" stroke-width="3" stroke-linecap="round"/>
        <path d="M44 3v4m5-1-3 3m-8-4 3 3m7 5h4" stroke="{fuse}" stroke-width="2" stroke-linecap="round"/>
        <rect x="29" y="15" width="13" height="9" rx="3" fill="#566074" transform="rotate(18 35 20)"/>
        <circle cx="30" cy="36" r="21" fill="{dark}"/>
        <path d="M17 33c0-7 6-12 12-12" fill="none" stroke="#526174" stroke-width="5" stroke-linecap="round"/>
        <circle cx="35" cy="44" r="2" fill="#667086" opacity=".6"/>
      ''')
      for index, color in enumerate(COLORS, 1):
        antenna = [
          f'<path d="M32 11V5m0 0c-8-6-12-2-9 2 2 3 7 2 9-2" fill="{color}" stroke="#245660" stroke-width="1.3"/>',
          f'<path d="M27 9l5-7 5 7z" fill="{color}" stroke="#795d2c" stroke-width="1.3"/>',
          f'<path d="M32 2l2 4 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1z" fill="{color}" stroke="#705e9b" stroke-width="1.2"/>',
          f'<circle cx="32" cy="6" r="5" fill="{color}" stroke="#337155" stroke-width="1.3"/>',
        ][index - 1]
        corners = 8 if theme == "arcade" else 14
        write(theme, f"player-{index}", f'''
          <ellipse cx="32" cy="58" rx="21" ry="5" fill="#192b38" opacity=".18"/>
          {antenna}
          <rect x="18" y="36" width="28" height="21" rx="9" fill="{color}"/>
          <rect x="12" y="40" width="9" height="12" rx="4" fill="{color}"/>
          <rect x="43" y="40" width="9" height="12" rx="4" fill="{color}"/>
          <rect x="18" y="52" width="12" height="9" rx="4" fill="#263444"/>
          <rect x="34" y="52" width="12" height="9" rx="4" fill="#263444"/>
          <rect x="11" y="9" width="42" height="34" rx="{corners}" fill="{color}"/>
          <path d="M20 14h17" stroke="#fff" opacity=".46" stroke-width="3" stroke-linecap="round"/>
          <rect x="17" y="20" width="30" height="17" rx="7" fill="#f6f4df"/>
          <rect x="24" y="24" width="4" height="8" rx="2" fill="#263444"/>
          <rect x="36" y="24" width="4" height="8" rx="2" fill="#263444"/>
          <circle cx="32" cy="47" r="6" fill="#fff" opacity=".85"/>
          <text x="32" y="50" text-anchor="middle" font-family="sans-serif" font-size="9" font-weight="bold" fill="#263444">{index}</text>
        ''')
    icons = {
        "flame": ('#fff0ce', '#ec8839', '<path d="M35 12c3 12-5 14-2 20 3-2 5-6 5-9 14 16 10 28-6 29-17 0-22-16-12-28-1 9 1 11 4 12-3-10 8-14 11-24z"/>'),
        "bomb": ('#e0edf8', '#426b91', '<circle cx="30" cy="37" r="15"/><path d="M34 23l4-8h7m-3-5 5 5-5 5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M28 30v14m-7-7h14" stroke="#e0edf8" stroke-width="3"/>'),
        "speed": ('#fbe5d9', '#da875c', '<path d="M25 17h15v17l10 5v9H19V36h6z"/><path d="M15 22H8m9 6H6m10 6H9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M21 42h27" stroke="#fbe5d9" stroke-width="2"/>'),
        "shield": ('#eae2fa', '#9774ca', '<path d="M32 12l18 7v13c0 12-18 21-18 21S14 44 14 32V19z"/><path d="M23 31l6 6 12-13" fill="none" stroke="#eae2fa" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'),
    }
    folder = ROOT / "textures" / "items"
    folder.mkdir(parents=True, exist_ok=True)
    for name, (background, color, body) in icons.items():
        content = f'<rect x="6" y="9" width="52" height="51" rx="12" fill="#263444" opacity=".13"/><rect x="6" y="5" width="52" height="51" rx="12" fill="{background}" stroke="#fff" stroke-width="2"/><g fill="{color}" color="{color}">{body}</g>'
        (folder / f"{name}.svg").write_text(svg(content), encoding="utf-8")


def build_sounds():
    sample_rate = 22050
    folder = ROOT / "audio"
    folder.mkdir(parents=True, exist_ok=True)
    notes = {
        "join": ([523.25, 783.99], .19),
        "countdown": ([660], .10),
        "start": ([523.25, 659.25, 783.99, 1046.5], .38),
        "place": ([160, 105], .12),
        "pickup": ([783.99, 987.77, 1174.66], .25),
        "elimination": ([392, 261.63, 164.81], .32),
        "shield": ([1046.5, 1318.51, 1567.98], .3),
        "victory": ([523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5], .85),
        "draw": ([392, 349.23, 261.63], .5),
    }
    for name, (frequencies, duration) in notes.items():
        samples = []
        note_length = duration / len(frequencies)
        for i in range(int(sample_rate * duration)):
            t = i / sample_rate
            frequency = frequencies[min(len(frequencies) - 1, int(t / note_length))]
            local_t = t % note_length
            envelope = min(1, local_t / .004) * max(0, 1 - local_t / note_length) ** 1.6
            tone = math.sin(2 * math.pi * frequency * t) + .18 * math.sin(4 * math.pi * frequency * t)
            samples.append(tone * envelope * .38)
        save_wave(folder / f"{name}.wav", samples, sample_rate)
    rng = random.Random(1711)
    samples = []
    low_noise = 0
    for i in range(int(sample_rate * .55)):
        t = i / sample_rate
        low_noise = .75 * low_noise + .25 * rng.uniform(-1, 1)
        envelope = min(1, t / .003) * math.exp(-t * 8)
        frequency = 85 - 55 * t
        tone = math.sin(2 * math.pi * frequency * t)
        samples.append((low_noise * 1.5 + tone * .42) * envelope * .65)
    save_wave(folder / "explosion.wav", samples, sample_rate)


def save_wave(path, samples, sample_rate):
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(sample_rate)
        output.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, sample)) * 32767)) for sample in samples))


if __name__ == "__main__":
    build_textures()
    build_sounds()
    print("Built 28 SVG textures and 10 WAV effects for Bomberman.")
