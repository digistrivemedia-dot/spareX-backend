// Jest setup file: every test process starts from the safe local values in .env.example (a real .env, if any,
// and the shell's own variables still win, since loadEnvFile never overwrites a variable that is already set).
process.loadEnvFile('.env.example');
