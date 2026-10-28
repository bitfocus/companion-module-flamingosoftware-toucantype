# companion-module-flamingosoftware-toucantype

A [Bitfocus Companion](https://bitfocus.io/companion) module for
[ToucanType](https://flamingo.software).

See [HELP.md](companion/HELP.md) for setup and a description of the actions,
variables and feedbacks.

## Development

```
corepack enable
yarn install
yarn package        # builds pkg/ and a .tgz
```

To run from source, point Companion's **Developer Modules** path at the folder
*containing* this one, and enable developer modules in the launcher.
