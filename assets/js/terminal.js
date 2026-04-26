'use strict';

(async function () {
  const terminalContainer = document.getElementById('terminal');
  if (!terminalContainer) return;

  let fileSystem = {};
  let currentPath = '/home/francesco';
  let commandHistory = [];
  let historyIndex = -1;

  // Load file system from JSON
  try {
    const response = await fetch('./assets/data/terminal-commands.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to load terminal data');
    const data = await response.json();
    fileSystem = data.fileSystem;
  } catch (error) {
    console.error('Error loading terminal data:', error);
    return;
  }

  function getNode(path) {
    if (path === '/home/francesco') return fileSystem['/home/francesco'];

    const relativePath = path.replace('/home/francesco/', '');
    const parts = relativePath.split('/').filter(p => p);
    let current = fileSystem['/home/francesco'];

    for (const part of parts) {
      if (!current.contents || !current.contents[part]) return null;
      current = current.contents[part];
    }
    return current;
  }

  function appendOutput(text, className = '') {
    const line = document.createElement('div');
    line.className = `terminal-output ${className}`;
    line.textContent = text;
    terminalContainer.appendChild(line);
    terminalContainer.scrollTop = terminalContainer.scrollHeight;
  }

  function displayPrompt() {
    const promptLine = document.createElement('div');
    promptLine.className = 'terminal-line';
    const displayPath = currentPath === '/home/francesco' ? '~' : currentPath.replace('/home/francesco', '~');
    promptLine.innerHTML = `<span class="terminal-prompt">francesco@platform-engineer:${Utils.escapeHtml(displayPath)}$ </span>`;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'terminal-input';
    input.placeholder = 'Enter command...';
    input.autocomplete = 'off';

    promptLine.appendChild(input);
    terminalContainer.appendChild(promptLine);
    input.focus();

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleCommand(input.value);
        promptLine.remove();
        displayPrompt();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        historyIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
        input.value = historyIndex >= 0 ? commandHistory[commandHistory.length - 1 - historyIndex] : '';
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        historyIndex = Math.max(historyIndex - 1, -1);
        input.value = historyIndex >= 0 ? commandHistory[commandHistory.length - 1 - historyIndex] : '';
      }
    });
  }

  function handleCommand(input) {
    const trimmed = input.trim();
    if (!trimmed) return;

    commandHistory.push(trimmed);
    historyIndex = -1;

    appendOutput(`$ ${trimmed}`, 'command');

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    if (cmd === 'pwd') {
      appendOutput(currentPath);
    } else if (cmd === 'whoami') {
      appendOutput('francesco');
    } else if (cmd === 'hostname') {
      appendOutput('platform-engineer');
    } else if (cmd === 'ls') {
      const node = getNode(currentPath);
      if (!node || node.type !== 'dir') {
        appendOutput('ls: cannot access: No such file or directory', 'error');
      } else if (!node.contents || Object.keys(node.contents).length === 0) {
        // Empty directory
      } else {
        const items = Object.keys(node.contents)
          .map(name => {
            const item = node.contents[name];
            return item.type === 'dir' ? name + '/' : name;
          })
          .sort();
        appendOutput(items.join('  '));
      }
    } else if (cmd === 'ls -la') {
      const node = getNode(currentPath);
      if (!node || node.type !== 'dir') {
        appendOutput('ls: cannot access: No such file or directory', 'error');
      } else {
        appendOutput('total 24');
        appendOutput('drwxr-xr-x 5 francesco francesco 4096 Apr 26 12:00 .');
        const parentDir = currentPath === '/home/francesco' ? '/home' : currentPath.substring(0, currentPath.lastIndexOf('/'));
        appendOutput(`drwxr-xr-x 3 root      root      4096 Apr 26 11:00 ..`);
        if (node.contents) {
          Object.keys(node.contents)
            .sort()
            .forEach(name => {
              const item = node.contents[name];
              const type = item.type === 'dir' ? 'd' : '-';
              appendOutput(`${type}rw-r--r-- 1 francesco francesco 4096 Apr 26 12:00 ${name}`);
            });
        }
      }
    } else if (cmd === 'cd') {
      if (!args) {
        currentPath = '/home/francesco';
      } else if (args === '~') {
        currentPath = '/home/francesco';
      } else if (args === '..') {
        if (currentPath !== '/home/francesco') {
          const parts = currentPath.split('/').filter(p => p);
          parts.pop();
          currentPath = '/' + parts.join('/');
        }
      } else if (args.startsWith('/')) {
        const node = getNode(args);
        if (!node || node.type !== 'dir') {
          appendOutput(`cd: ${args}: No such file or directory`, 'error');
        } else {
          currentPath = args;
        }
      } else {
        const newPath = currentPath === '/home/francesco'
          ? `/home/francesco/${args}`
          : `${currentPath}/${args}`;
        const node = getNode(newPath);
        if (!node || node.type !== 'dir') {
          appendOutput(`cd: ${args}: No such file or directory`, 'error');
        } else {
          currentPath = newPath;
        }
      }
    } else if (cmd === 'cat') {
      if (!args) {
        appendOutput('cat: missing file argument', 'error');
      } else {
        let filePath;
        if (args.startsWith('/')) {
          filePath = args;
        } else {
          filePath = currentPath === '/home/francesco'
            ? `/home/francesco/${args}`
            : `${currentPath}/${args}`;
        }

        const node = getNode(filePath);
        if (!node) {
          appendOutput(`cat: ${args}: No such file or directory`, 'error');
        } else if (node.type === 'dir') {
          appendOutput(`cat: ${args}: Is a directory`, 'error');
        } else {
          appendOutput(node.content);
        }
      }
    } else if (cmd === 'clear') {
      terminalContainer.innerHTML = '';
    } else if (cmd === 'history') {
      commandHistory.forEach((cmd, idx) => {
        appendOutput(`${idx + 1}  ${cmd}`);
      });
    } else if (cmd === 'date') {
      appendOutput('Sun Apr 26 2026 12:00:00 GMT+0000 (UTC)');
    } else if (cmd === 'uname') {
      appendOutput('Linux');
    } else if (cmd === 'uname -a') {
      appendOutput('Linux platform-engineer 6.1.0-ubuntu #1 SMP x86_64 GNU/Linux');
    } else if (cmd === 'echo') {
      appendOutput(args || '');
    } else if (cmd === 'grep') {
      appendOutput('grep: usage: grep [OPTION]... PATTERNS [FILE]...', 'error');
    } else if (cmd === 'man') {
      if (!args) {
        appendOutput('man: what manual page do you want?', 'error');
      } else {
        appendOutput(`No manual entry for ${args}`, 'error');
      }
    } else if (cmd === 'mkdir') {
      appendOutput('mkdir: operation not supported', 'error');
    } else if (cmd === 'touch') {
      appendOutput('touch: operation not supported', 'error');
    } else if (cmd === 'rm') {
      appendOutput('rm: operation not supported', 'error');
    } else if (cmd === 'tree') {
      const renderTree = (node, prefix = '') => {
        if (!node.contents) return;
        const items = Object.keys(node.contents).sort();
        items.forEach((name, idx) => {
          const isLast = idx === items.length - 1;
          const item = node.contents[name];
          const connector = isLast ? '└── ' : '├── ';
          const nextPrefix = prefix + (isLast ? '    ' : '│   ');
          const icon = item.type === 'dir' ? name + '/' : name;
          appendOutput(prefix + connector + icon);
          if (item.type === 'dir') {
            renderTree(item, nextPrefix);
          }
        });
      };

      const node = getNode(currentPath);
      if (!node || node.type !== 'dir') {
        appendOutput('tree: command not found', 'error');
      } else {
        const displayPath = currentPath === '/home/francesco' ? '~' : currentPath.replace('/home/francesco', '~');
        appendOutput(displayPath + '/');
        renderTree(node);
      }
    } else if (cmd === 'help') {
      const help = `Available commands:

Navigation & Files:
  cd <dir>      - Change directory (cd .., cd ~, cd /)
  pwd           - Print working directory
  ls            - List directory contents
  ls -la        - Detailed listing
  cat <file>    - Display file contents
  tree          - Show directory tree

System Info:
  whoami        - Print current user
  hostname      - Print system hostname
  date          - Show current date/time
  uname         - Show system information
  uname -a      - Detailed system info

Other:
  echo <text>   - Print text
  history       - Show command history
  clear         - Clear terminal
  help          - Show this help message

Try: cd portfolio → ls → cat about`;
      appendOutput(help);
    } else {
      appendOutput(`command not found: ${cmd}. Type 'help' for available commands.`, 'error');
    }
  }

  appendOutput('Welcome to Francesco Wang\'s Interactive Portfolio');
  appendOutput('Type "help" to see available commands.\n');
  displayPrompt();
})();
