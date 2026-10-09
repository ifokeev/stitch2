# Security

stitch2 runs on developers' machines: it serves a local canvas, renders screens in Chromium and runs the scripts a
project's config names. Please report a vulnerability privately through GitHub (**Security → Report a
vulnerability** on this repository), not in a public issue. Include the version, how to reproduce it and what an
attacker could do with it; we aim to answer within a week.

Of particular interest: the canvas server exposing files outside the design folder or accepting requests from other
sites, and anything that runs code a user did not ask for.
