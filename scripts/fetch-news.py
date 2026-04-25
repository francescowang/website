import urllib.request
import json
import os
import ssl

# Create unverified SSL context to handle potential cert issues in CI
ssl_context = ssl._create_unverified_context()

HN_API = 'https://hacker-news.firebaseio.com/v0'
AWS_SECURITY_RSS = 'https://aws.amazon.com/blogs/security/feed/'
RSS2JSON_API = 'https://api.rss2json.com/v1/api.json'
COUNT = 10

def get_json(url):
    with urllib.request.urlopen(url, context=ssl_context) as response:
        return json.loads(response.read().decode())

def fetch_hn():
    try:
        top_ids = get_json(f"{HN_API}/topstories.json")
        stories = []
        for story_id in top_ids[:COUNT]:
            story = get_json(f"{HN_API}/item/{story_id}.json")
            if story and 'title' in story and 'url' in story:
                stories.append({
                    "title": story['title'],
                    "url": story['url'],
                    "score": story.get('score', 0),
                    "comments": story.get('descendants', 0),
                    "source": story['url'].split('/')[2].replace('www.', '')
                })
        return stories
    except Exception as e:
        print(f"Error fetching HN: {e}")
        return []

def fetch_security():
    try:
        url = f"{RSS2JSON_API}?rss_url={urllib.parse.quote(AWS_SECURITY_RSS)}&count={COUNT}"
        data = get_json(url)
        if data['status'] == 'ok':
            return [{
                "title": item['title'],
                "url": item['link'],
                "date": item['pubDate'],
                "author": item.get('author', 'AWS Security')
            } for item in data['items']]
        return []
    except Exception as e:
        print(f"Error fetching Security: {e}")
        return []

if __name__ == "__main__":
    cache = {
        "tech": fetch_hn(),
        "security": fetch_security()
    }
    
    output_path = os.path.join('assets', 'data', 'news-cache.json')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(cache, f, indent=2)
    
    print(f"Successfully cached news to {output_path}")
