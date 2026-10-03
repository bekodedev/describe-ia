// "--name value" pairs from the command line. The scripts have a handful of options, no need for a library.
export function readArgs(argv: string[] = process.argv.slice(2)): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i];
    const value = argv[i + 1];
    if (!name?.startsWith('--') || value === undefined) {
      throw new Error(`Expected "--name value" pairs, got "${argv.slice(i).join(' ')}"`);
    }
    args[name.slice(2)] = value;
  }
  return args;
}
