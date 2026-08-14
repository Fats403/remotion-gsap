# Contributing

The most valuable contributions strengthen the deterministic contract.

Before submitting a change, run:

```sh
pnpm test:all
```

Bug reports should include the composition fps, target frame, whether the frame was reached directly or through scrubbing, and a minimal timeline. A fix for lifecycle, plugin, or renderer behavior should include a regression test that reaches the same frame in more than one order.
