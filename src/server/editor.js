import path from 'node:path';

export function registerEditorRoutes(app, _ctx) {
  app.get('/api/editor/lang', (req, res) => {
    const ext = path.extname(req.query.path || '').toLowerCase();
    const map = {
      '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.ts': 'typescript',
      '.tsx': 'tsx', '.jsx': 'jsx', '.json': 'json', '.md': 'markdown', '.html': 'html',
      '.css': 'css', '.scss': 'scss', '.py': 'python', '.go': 'go', '.rs': 'rust',
      '.java': 'java', '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.cs': 'csharp', '.sh': 'bash',
      '.ps1': 'powershell', '.yml': 'yaml', '.yaml': 'yaml', '.toml': 'toml', '.xml': 'xml',
      '.sql': 'sql', '.rb': 'ruby', '.php': 'php', '.swift': 'swift', '.kt': 'kotlin',
    };
    res.json({ language: map[ext] || 'plaintext' });
  });
}
