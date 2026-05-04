pnpm -r build              # build everything once
pnpm --filter api dev      # terminal 1
pnpm --filter web dev      # terminal 2
pnpm --filter cli dev -- https://example.com   # terminal 3, ad-hoc