const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { marked } = require('marked');
const hljs = require('highlight.js');
const matter = require('gray-matter');

const app = express();
const PORT = process.env.DOCS_PORT || 3100;
const PROJECT_ROOT = path.join(__dirname, '..');

// Configure marked with syntax highlighting
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (err) {}
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true,
  gfm: true
});

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/highlight-styles', express.static(path.join(__dirname, 'node_modules', 'highlight.js', 'styles')));

// Scan and index all markdown files
async function scanDocs() {
  const docs = [];
  const rootFiles = [];
  const docsFiles = [];
  
  // Scan root directory
  const rootItems = await fs.readdir(PROJECT_ROOT);
  for (const item of rootItems) {
    if (item.endsWith('.md')) {
      const filePath = path.join(PROJECT_ROOT, item);
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = matter(content);
      
      rootFiles.push({
        name: item,
        path: item,
        title: parsed.data.title || item.replace('.md', '').replace(/-/g, ' '),
        category: 'Root',
        size: stats.size,
        modified: stats.mtime
      });
    }
  }
  
  // Scan docs directory
  const docsDir = path.join(PROJECT_ROOT, 'docs');
  if (await fs.pathExists(docsDir)) {
    const docsItems = await fs.readdir(docsDir);
    for (const item of docsItems) {
      if (item.endsWith('.md')) {
        const filePath = path.join(docsDir, item);
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = matter(content);
        
        docsFiles.push({
          name: item,
          path: `docs/${item}`,
          title: parsed.data.title || item.replace('.md', '').replace(/-/g, ' '),
          category: 'Documentation',
          size: stats.size,
          modified: stats.mtime
        });
      }
    }
  }
  
  // Categorize documents
  const categories = {
    'Главная': [],
    'Архитектура': [],
    'Развертывание': [],
    'API': [],
    'Отчеты': [],
    'Исправления': [],
    'Руководства': [],
    'Прочее': []
  };
  
  const allDocs = [...rootFiles, ...docsFiles];
  
  allDocs.forEach(doc => {
    const name = doc.name.toUpperCase();
    
    if (name.includes('README') || name.includes('DOCUMENTATION-SUMMARY') || name.includes('VSS-DOCUMENTATION-INDEX')) {
      categories['Главная'].push(doc);
    } else if (name.includes('ARCHITECTURE') || name.includes('TECH-STACK') || name.includes('INFRASTRUCTURE')) {
      categories['Архитектура'].push(doc);
    } else if (name.includes('DEPLOYMENT') || name.includes('QUICKSTART') || name.includes('STARTUP') || name.includes('SETUP') || name.includes('START-VSS')) {
      categories['Развертывание'].push(doc);
    } else if (name.includes('API')) {
      categories['API'].push(doc);
    } else if (name.includes('REPORT') || name.includes('AUDIT') || name.includes('TESTING') || name.includes('STATUS') || name.includes('SUCCESS')) {
      categories['Отчеты'].push(doc);
    } else if (name.includes('FIX') || name.includes('TROUBLESHOOTING')) {
      categories['Исправления'].push(doc);
    } else if (name.includes('MANUAL') || name.includes('GUIDE') || name.includes('COMMANDS') || name.includes('REFERENCE') || name.includes('LOGIN') || name.includes('SETTINGS')) {
      categories['Руководства'].push(doc);
    } else {
      categories['Прочее'].push(doc);
    }
  });
  
  return categories;
}

// Home page
app.get('/', async (req, res) => {
  try {
    const categories = await scanDocs();
    const totalDocs = Object.values(categories).reduce((sum, arr) => sum + arr.length, 0);
    
    res.send(generateHomePage(categories, totalDocs));
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

// View document
app.get('/doc/:path(*)', async (req, res) => {
  try {
    const docPath = req.params.path;
    const fullPath = path.join(PROJECT_ROOT, docPath);
    
    if (!await fs.pathExists(fullPath)) {
      return res.status(404).send('Document not found');
    }
    
    const content = await fs.readFile(fullPath, 'utf-8');
    const parsed = matter(content);
    const html = marked(parsed.content);
    
    res.send(generateDocPage(docPath, html, parsed.data));
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

// Search API
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q?.toLowerCase() || '';
    const categories = await scanDocs();
    const allDocs = Object.values(categories).flat();
    
    const results = allDocs.filter(doc => 
      doc.name.toLowerCase().includes(query) || 
      doc.title.toLowerCase().includes(query)
    );
    
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function generateHomePage(categories, totalDocs) {
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VSS OMNI TELECOM - Портал документации</title>
    <link rel="stylesheet" href="/highlight-styles/github-dark.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            padding: 30px 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            margin-bottom: 30px;
        }
        
        h1 {
            color: #667eea;
            font-size: 2.5em;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .logo {
            font-size: 1.2em;
        }
        
        .subtitle {
            color: #666;
            font-size: 1.1em;
        }
        
        .stats {
            display: flex;
            gap: 20px;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        
        .stat {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 10px 20px;
            border-radius: 10px;
            font-weight: 600;
        }
        
        .search-box {
            background: white;
            padding: 20px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            margin-bottom: 30px;
        }
        
        .search-input {
            width: 100%;
            padding: 15px 20px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 1.1em;
            transition: all 0.3s;
        }
        
        .search-input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .categories {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 25px;
        }
        
        .category {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            transition: transform 0.3s, box-shadow 0.3s;
        }
        
        .category:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
        }
        
        .category-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
            padding-bottom: 15px;
            border-bottom: 2px solid #f0f0f0;
        }
        
        .category-icon {
            font-size: 1.5em;
        }
        
        .category h2 {
            color: #333;
            font-size: 1.3em;
            flex: 1;
        }
        
        .doc-count {
            background: #667eea;
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: 600;
        }
        
        .doc-list {
            list-style: none;
        }
        
        .doc-item {
            padding: 12px;
            margin: 8px 0;
            background: #f8f9fa;
            border-radius: 8px;
            transition: all 0.3s;
            border-left: 3px solid transparent;
        }
        
        .doc-item:hover {
            background: #e8e9ff;
            border-left-color: #667eea;
            transform: translateX(5px);
        }
        
        .doc-item a {
            color: #333;
            text-decoration: none;
            display: block;
            font-weight: 500;
        }
        
        .doc-item a:hover {
            color: #667eea;
        }
        
        .empty-category {
            color: #999;
            font-style: italic;
            text-align: center;
            padding: 20px;
        }
        
        .footer {
            text-align: center;
            color: white;
            margin-top: 40px;
            padding: 20px;
            font-size: 0.9em;
        }
        
        @media (max-width: 768px) {
            .categories {
                grid-template-columns: 1fr;
            }
            
            h1 {
                font-size: 1.8em;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1><span class="logo">📚</span> VSS OMNI TELECOM</h1>
            <p class="subtitle">Портал документации проекта</p>
            <div class="stats">
                <div class="stat">📄 Документов: ${totalDocs}</div>
                <div class="stat">📂 Категорий: ${Object.keys(categories).filter(k => categories[k].length > 0).length}</div>
                <div class="stat">🚀 Версия: 2.1.0</div>
            </div>
        </header>
        
        <div class="search-box">
            <input type="text" class="search-input" id="searchInput" placeholder="🔍 Поиск документации...">
            <div id="searchResults"></div>
        </div>
        
        <div class="categories" id="categoriesContainer">
            ${Object.entries(categories).map(([category, docs]) => `
                <div class="category ${docs.length === 0 ? 'hidden' : ''}">
                    <div class="category-header">
                        <span class="category-icon">${getCategoryIcon(category)}</span>
                        <h2>${category}</h2>
                        <span class="doc-count">${docs.length}</span>
                    </div>
                    ${docs.length > 0 ? `
                        <ul class="doc-list">
                            ${docs.map(doc => `
                                <li class="doc-item">
                                    <a href="/doc/${doc.path}">${doc.title}</a>
                                </li>
                            `).join('')}
                        </ul>
                    ` : '<p class="empty-category">Нет документов</p>'}
                </div>
            `).join('')}
        </div>
        
        <div class="footer">
            <p>VSS OMNI TELECOM Documentation Portal | Powered by Node.js & Express</p>
            <p>© 2025 VSS Technologies. All rights reserved.</p>
        </div>
    </div>
    
    <script>
        let debounceTimer;
        document.getElementById('searchInput').addEventListener('input', function(e) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const query = e.target.value.trim();
                if (query.length < 2) {
                    document.getElementById('categoriesContainer').style.display = 'grid';
                    return;
                }
                
                fetch('/api/search?q=' + encodeURIComponent(query))
                    .then(r => r.json())
                    .then(results => {
                        if (results.length > 0) {
                            document.getElementById('categoriesContainer').style.display = 'none';
                            document.getElementById('searchResults').innerHTML = 
                                '<div class="category"><div class="category-header"><span class="category-icon">🔍</span><h2>Результаты поиска</h2><span class="doc-count">' + results.length + '</span></div><ul class="doc-list">' +
                                results.map(doc => '<li class="doc-item"><a href="/doc/' + doc.path + '">' + doc.title + '</a></li>').join('') +
                                '</ul></div>';
                        } else {
                            document.getElementById('searchResults').innerHTML = '<p class="empty-category">Ничего не найдено</p>';
                        }
                    });
            }, 300);
        });
        
        function getCategoryIcon(category) {
            const icons = {
                'Главная': '🏠',
                'Архитектура': '🏗️',
                'Развертывание': '🚀',
                'API': '⚡',
                'Отчеты': '📊',
                'Исправления': '🔧',
                'Руководства': '📖',
                'Прочее': '📁'
            };
            return icons[category] || '📄';
        }
    </script>
</body>
</html>
  `;
}

function getCategoryIcon(category) {
  const icons = {
    'Главная': '🏠',
    'Архитектура': '🏗️',
    'Развертывание': '🚀',
    'API': '⚡',
    'Отчеты': '📊',
    'Исправления': '🔧',
    'Руководства': '📖',
    'Прочее': '📁'
  };
  return icons[category] || '📄';
}

function generateDocPage(docPath, html, metadata) {
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.title || docPath} - VSS Documentation</title>
    <link rel="stylesheet" href="/highlight-styles/github-dark.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .nav {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            padding: 15px 30px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 20px;
        }
        
        .nav a {
            color: #667eea;
            text-decoration: none;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s;
        }
        
        .nav a:hover {
            color: #764ba2;
            transform: translateX(-5px);
        }
        
        .doc-title {
            flex: 1;
            font-size: 1.2em;
            color: #333;
            font-weight: 600;
        }
        
        .content {
            background: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(10px);
            padding: 40px;
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            line-height: 1.8;
        }
        
        .content h1 {
            color: #667eea;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 3px solid #667eea;
        }
        
        .content h2 {
            color: #764ba2;
            margin-top: 30px;
            margin-bottom: 15px;
        }
        
        .content h3 {
            color: #555;
            margin-top: 25px;
            margin-bottom: 12px;
        }
        
        .content p {
            margin-bottom: 15px;
            color: #333;
        }
        
        .content ul, .content ol {
            margin-bottom: 15px;
            margin-left: 30px;
        }
        
        .content li {
            margin-bottom: 8px;
        }
        
        .content code {
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            color: #e83e8c;
        }
        
        .content pre {
            background: #282c34;
            padding: 20px;
            border-radius: 10px;
            overflow-x: auto;
            margin: 20px 0;
        }
        
        .content pre code {
            background: none;
            padding: 0;
            color: #abb2bf;
        }
        
        .content table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        
        .content table th {
            background: #667eea;
            color: white;
            padding: 12px;
            text-align: left;
        }
        
        .content table td {
            padding: 12px;
            border-bottom: 1px solid #e0e0e0;
        }
        
        .content blockquote {
            border-left: 4px solid #667eea;
            padding-left: 20px;
            margin: 20px 0;
            color: #666;
            font-style: italic;
        }
        
        .content a {
            color: #667eea;
            text-decoration: none;
            border-bottom: 1px solid transparent;
            transition: all 0.3s;
        }
        
        .content a:hover {
            border-bottom-color: #667eea;
        }
        
        .content img {
            max-width: 100%;
            height: auto;
            border-radius: 10px;
            margin: 20px 0;
        }
        
        @media (max-width: 768px) {
            .content {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="nav">
            <a href="/">← Вернуться к списку</a>
            <span class="doc-title">📄 ${metadata.title || docPath}</span>
        </div>
        
        <div class="content">
            ${html}
        </div>
    </div>
</body>
</html>
  `;
}

app.listen(PORT, () => {
  console.log(`\n📚 VSS Documentation Portal is running!`);
  console.log(`🌐 Open: http://localhost:${PORT}`);
  console.log(`📖 Total documents indexed from project root and docs/\n`);
});

