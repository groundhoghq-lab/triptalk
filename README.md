# TripTalk

TripTalk is a standalone Greek travel phrase flashcard app. It runs entirely from local files and combines illustrated cards with English and Greek MP3 audio for common travel situations in Greece.

## Features

- Section carousel for browsing phrase decks before starting a card session.
- Illustrated flashcards backed by local PNG assets.
- English and Greek audio for each phrase, loaded from local MP3 files.
- Automatic English playback when a card appears.
- Bottom transport controls for section navigation, card navigation, and target-language audio play/pause/resume.
- Adjustable target audio speed from 75% to 150%.
- Shuffle mode for practicing cards in random order.
- Global Mode for practicing every section as one combined deck.
- Continuous Playback mode for hands-free practice.
- Hamburger menu with Settings, Pronunciation, Help, and About.
- Settings modal with English, Global, Shuffle, Continuous, Continuous pause, and Target Audio Speed controls.
- Built-in help panel, pronunciation guide, and about screen.
- Responsive layout for desktop and mobile browsers.
- Offline-first design with no internet connection or package install required.

## Phrase Sections

The app currently includes these sections:

- Acropolis
- Airport
- Common
- Customs
- Dining
- Hotel
- Meteora
- Museum
- Mykonos
- Piraeus
- Santorini
- Shopping
- Travel

## How To Run

1. Open the project folder.
2. Open `index.html` in a desktop or mobile web browser.
3. Use any first click/tap/key interaction to allow browser audio playback.

No build step, server, or dependency installation is required.

## How To Use

- Click the center section card to start that section.
- Click side cards or section dots to switch sections before starting.
- Click the center flashcard to advance to the next card.
- Use the bottom transport controls to move between sections, move between cards, and play, pause, or resume target-language audio.
- Open Settings from the hamburger menu to toggle English, Continuous, Global, or Shuffle, adjust the Continuous pause, or change Target Audio Speed.
- Turn on Shuffle to randomize card order for each section.
- Turn on Global Mode to combine every section into one deck; when Global Mode and Shuffle are both on, all cards are shuffled together across sections.

When you move past the last card in a section, TripTalk automatically opens the next section. Moving backward from the first card opens the previous section.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Enter` | Start or advance to the next card |
| `Space` | Start from section view, or play/pause/resume Greek audio in card view |
| `Arrow Left` / `Arrow Right` | Change sections before card mode; previous/next card in card mode |
| `Shift + Arrow Left` / `Shift + Arrow Right` | Change sections while in card mode |
| `,` / `.` | Previous/next, like the arrow keys |
| `<` / `>` | Change sections, like shifted arrow keys |
| `R` | Reset the current card, rewind its audio, and replay English if English is on |
| `E` | Toggle automatic English playback |
| `C` | Toggle Continuous Playback |
| `G` | Toggle Global Mode across all sections |
| `[` / `]` | Decrease/increase the Continuous Playback pause |
| `+` / `-` | Increase/decrease target audio speed by 5% |
| `S` | Toggle shuffled card order |
| `P` | Toggle the pronunciation guide |
| `I` | Toggle the about screen |
| `H` or `?` | Toggle the help panel |
| `Escape` | Close open panels or the hamburger menu |

## Project Structure

```text
index.html             Main app shell
scripts/phrases.js    Phrase data used by the app
scripts/triptalk.js   Carousel, audio, shuffle, help, and keyboard behavior
styles/triptalk.css   Responsive visual design
images/               Section and flashcard PNG artwork
media/                English and Greek MP3 audio
tools/                Helper files used while preparing phrase assets
```

## Asset Conventions

Phrase records use ids such as `airport_001`. TripTalk uses that id to resolve the matching local assets:

- Card image: `images/airport/airport_001.png`
- English audio: `media/airport/English/airport_001.mp3`
- Greek audio: `media/airport/Greek/airport_001.mp3`

Section cards use:

- Default image: `images/<section>/section_images/<section>.png`
- Hover/color image: `images/<section>/section_images/<section>_color.png`

Keep new section names and ids lowercase in asset paths so they match the app's resolver.
