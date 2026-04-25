'use strict';

(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const postSlug = urlParams.get('post');

  if (!postSlug) {
    document.getElementById('post-content').innerHTML = '<p>No post specified.</p>';
    return;
  }

  Promise.all([
    fetch('../assets/data/posts-meta.json', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('Failed to load post index');
      return r.json();
    }),
    fetch('./posts/' + postSlug + '.md', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('Post not found');
      return r.text();
    })
  ])
    .then(function (results) {
      const allPosts = results[0];
      const content = results[1];

      const post = allPosts.find(function (p) { return p.slug === postSlug; });
      if (!post) throw new Error('Post metadata not found');

      document.title = post.title + ' | Francesco Wang';
      document.getElementById('post-category').textContent = post.category || '';
      document.getElementById('post-title').textContent = post.title;

      if (post.date) {
        const dateEl = document.getElementById('post-date');
        dateEl.textContent = new Date(post.date).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric'
        });
        dateEl.setAttribute('datetime', post.date);
      }

      if (post.tags && post.tags.length) {
        document.getElementById('post-tags').innerHTML = post.tags
          .map(function (tag) { return '<span class="post-tag">' + tag + '</span>'; })
          .join('');
      }

      document.getElementById('post-content').innerHTML = marked.parse(content);

      const wordCount = content.split(/\s+/).length;
      document.getElementById('post-reading-time').textContent = Math.ceil(wordCount / 200) + ' min read';
    })
    .catch(function (error) {
      console.error('Error loading post:', error);
      document.getElementById('post-content').innerHTML = '<p>Error loading post. Please try again.</p>';
    });
})();

      .then(function (response) {
        if (!response.ok) throw new Error('Post not found');
        return response.text();
      })
      .then(function (raw) {
        const { meta, content } = parseFrontmatter(raw);

        document.title = `${meta.title || postSlug} | Francesco Wang`;
        document.getElementById('post-category').textContent = meta.category || '';
        document.getElementById('post-title').textContent = meta.title || postSlug;

        if (meta.date) {
          document.getElementById('post-date').textContent = new Date(meta.date).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric'
          });
          document.getElementById('post-date').setAttribute('datetime', meta.date);
        }

        if (meta.tags) {
          const tagsArr = meta.tags.split(',').map(t => t.trim());
          document.getElementById('post-tags').innerHTML = tagsArr.map(tag => `<span class="post-tag">${tag}</span>`).join('');
        }

        document.getElementById('post-content').innerHTML = marked.parse(content);

        const wordCount = content.split(/\s+/).length;
        document.getElementById('post-reading-time').textContent = `${Math.ceil(wordCount / 200)} min read`;
      })
      .catch(function (error) {
        console.error('Error loading post:', error);
        document.getElementById('post-content').innerHTML = '<p>Error loading post. Please try again.</p>';
      });
  }
})();
