# Toy Simulation

The first simulator is intentionally simple. It does not model orbital mechanics. Instead, it models coordination logic:

- two operators receive the same conjunction event;
- one sends `MANEUVER_INTENT`;
- the other sends `RESPONSIBILITY_CLAIM`;
- the simulator compares coordinated and uncoordinated outcomes.

This is useful for the paper because it demonstrates the governance point: autonomous satellites do not only need to know where objects are. They need a shared interface for intent, responsibility, and confirmation.

Run:

```bash
python sim/run_toy_sim.py
```
