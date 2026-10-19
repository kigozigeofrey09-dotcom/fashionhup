import { spawn } from 'child_process';

function runCommand(command, args, name) {
  const child = spawn(command, args, { stdio: 'inherit', shell: true });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`[${name}] exited with code ${code}. Restarting in 2 seconds...`);
      setTimeout(() => runCommand(command, args, name), 2000);
    }
  });
  return child;
}

console.log('Starting FashionHub backend and frontend concurrently...');
runCommand('npm', ['run', 'backend'], 'Backend');
runCommand('npm', ['run', 'dev'], 'Frontend');
