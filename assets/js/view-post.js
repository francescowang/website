'use strict';

(function () {

  // ── Reading progress bar ────────────────────────────────────────────────
  var progressBar = document.getElementById('reading-progress');
  if (progressBar) {
    window.addEventListener('scroll', function () {
      var scrollTop    = document.documentElement.scrollTop || document.body.scrollTop;
      var scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      progressBar.style.width = (scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0) + '%';
    }, { passive: true });
  }

  // ── Copy code buttons ───────────────────────────────────────────────────
  function addCopyButtons(container) {
    container.querySelectorAll('pre').forEach(function (pre) {
      var code = pre.querySelector('code');
      if (!code) return;

      var btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.textContent = 'Copy';
      btn.setAttribute('aria-label', 'Copy code to clipboard');

      btn.addEventListener('click', function () {
        navigator.clipboard.writeText(code.textContent).then(function () {
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(function () {
            btn.textContent = 'Copy';
            btn.classList.remove('copied');
          }, 2000);
        }).catch(function () {
          btn.textContent = 'Error';
          setTimeout(function () { btn.textContent = 'Copy'; }, 2000);
        });
      });

      pre.appendChild(btn);
    });
  }

  // ── Post fetch + render ─────────────────────────────────────────────────
  const urlParams = new URLSearchParams(window.location.search);
  const postSlug = urlParams.get('post');

  if (!postSlug) {
    document.getElementById('post-content').innerHTML = '<p>No post specified.</p>';
    return;
  }

  // Fetch both metadata files to find the post
  const metaSources = [
    '../assets/data/posts-meta.json',
    '../assets/data/tutorials-meta.json'
  ];

  Promise.all(metaSources.map(url => 
    fetch(url, { cache: 'no-store' })
      .then(res => res.ok ? res.json() : [])
      .catch(err => {
        console.warn(`Failed to fetch metadata from ${url}:`, err);
        return [];
      })
  ))
    .then(function (metaResults) {
      // Compatibility-safe flattening
      const allPosts = [].concat.apply([], metaResults);
      const post = allPosts.find(function (p) { return p.slug === postSlug; });
      
      if (!post) {
        console.error('Available slugs:', allPosts.map(p => p.slug));
        throw new Error('Post metadata not found for slug: ' + postSlug);
      }

      // Path is relative to blog/view.html. 
      // Posts are in blog/posts/ (e.g. blog/posts/kubernetes/file.md)
      const primaryPath = './posts/' + (post.folder ? post.folder + '/' : '') + postSlug + '.md';
      const fallbackPath = './posts/' + postSlug + '.md';

      return fetch(primaryPath, { cache: 'no-store' })
        .then(function (r) {
          if (r.ok) return r.text();
          return fetch(fallbackPath, { cache: 'no-store' }).then(function (r2) {
            if (!r2.ok) throw new Error('Markdown file not found at ' + primaryPath + ' or ' + fallbackPath);
            return r2.text();
          });
        })
        .then(function (content) { return { post: post, content: content }; });
    })
    .then(function (result) {
      const post = result.post;
      const content = result.content;

      document.title = post.title + ' | Francesco Wang';
      
      const categoryEl = document.getElementById('post-category');
      if (categoryEl) categoryEl.textContent = post.category || '';
      
      const titleEl = document.getElementById('post-title');
      if (titleEl) titleEl.textContent = post.title;

      if (post.date) {
        const dateEl = document.getElementById('post-date');
        if (dateEl) {
          dateEl.textContent = new Date(post.date).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric'
          });
          dateEl.setAttribute('datetime', post.date);
        }
      }

      const tagsEl = document.getElementById('post-tags');
      if (tagsEl && post.tags && post.tags.length) {
        tagsEl.innerHTML = post.tags
          .map(function (tag) { return '<span class="post-tag">' + tag + '</span>'; })
          .join('');
      }

      const contentEl = document.getElementById('post-content');
      if (contentEl) {
        contentEl.innerHTML = marked.parse(content);
        addCopyButtons(contentEl);

        const wordCount = content.split(/\s+/).length;
        const readingTime = Math.ceil(wordCount / 200);
        const timeEl = document.getElementById('post-reading-time');
        if (timeEl) timeEl.textContent = readingTime + ' min read';
      }
    })
    .catch(function (error) {
      console.error('Error loading post:', error);
      const contentEl = document.getElementById('post-content');
      if (contentEl) {
        contentEl.innerHTML = `
          <div class="error-container">
            <p>Error loading post. Please try again.</p>
            <p style="font-size: var(--fs-8); color: var(--light-gray-70); margin-top: 10px;">
              Details: ${error.message}
            </p>
          </div>
        `;
      }
    });
})();
