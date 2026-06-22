# Why Curbox needs funding

## What Curbox is

Curbox is an open-source screen-time and app blocker. It helps people cut down on doomscrolling, short-form feeds, and compulsive app use. You pick the apps, sites, and feeds to watch, and Curbox steps in with a pause screen, a cooldown, or a small task before you can keep going. No accounts. Everything ships under GPL v3, with the full source public for anyone to read and audit.

Today Curbox runs on two platforms:

- **Android app** ([github.com/nethical6/curbox](https://github.com/nethical6/curbox)) — blocks whole apps, single features like Reels or Shorts, or specific URL paths. It has focus sessions, usage limits, schedules, and unlock mechanisms like QR-scan and type-to-unlock.
- **Browser extension** for Chrome, Brave, and Firefox ([github.com/curbox-app/web-extension](https://github.com/curbox-app/web-extension)) — tracks active viewing time, blocks sites in groups by usage or time, and filters feeds like Reels and Shorts with keyword and pattern matching, leaving the rest of a site usable.

Both are built and shipped in the open by one maintainer with help from the community.

## The gap: no iOS version

The one platform Curbox does not cover is iOS, and the reason is plain. iOS development requires a physical Apple device to build, test, and submit an app. I do not own one. Apple's Screen Time and Family Controls APIs can only be exercised on real hardware, so without an iPhone there is no way to start an iOS port at all.

This is not a small audience. People who rely on assistive features, who manage attention conditions, or who need external structure to limit compulsive use are split across phone platforms like everyone else. Right now the iPhone users among them have no Curbox option.

## Why it matters for cognitive disability

Curbox is, in practice, an assistive tool. The whole design is about moving a decision out of the moment of impulse and into a calmer moment beforehand, which is exactly the kind of support that helps people with ADHD, executive-function differences, and other cognitive disabilities.

- **The pause screen and cooldowns** give a buffer between an impulse and an action, which is the hardest gap to hold for someone with poor impulse control.
- **Type-to-unlock and QR-scan unlocks** turn an automatic tap into a deliberate, physical step. You have to walk to a code or type out why you want the app, which interrupts the autopilot loop.
- **Usage limits and schedules** provide the external structure that many people with executive-function challenges cannot reliably generate on their own.
- **Live counters and grayscale nudges** make invisible habits visible, which supports self-awareness without shame or lectures.
- **Open source and no accounts** matters for people who are wary of their data being used against them and for caregivers setting up a device for someone they support. The code is public, so anyone can verify what it does.

Because Curbox is open source, anyone can run it, inspect it, adapt it, and pass it on, which is the difference between a real option and a theoretical one for people who need external structure to manage compulsive use.

## What the funding buys

The grant covers one thing: a used iPhone so I can build, test, and submit the iOS version of Curbox.

That single device unblocks the entire platform. Once I can run and test on real hardware, I can build against Apple's Screen Time APIs, ship to TestFlight, and put Curbox in front of iPhone users who currently have nothing. It is a small, concrete cost with a clear result: the assistive features described above, available to a group that cannot use them today.
