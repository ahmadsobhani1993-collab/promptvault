import os

if os.path.exists('/root/.env'):
    with open('/root/.env') as _f:
        for _l in _f:
            if '=' in _l and not _l.startswith('#'):
                _k, _v = _l.strip().split('=', 1)
                os.environ[_k] = _v
import re
import json
import uuid
import requests
import feedparser
from datetime import datetime
from bs4 import BeautifulSoup
from supabase import create_client

# ---  ---
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_KEY = os.getenv('SUPABASE_KEY', '')
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---    ---
WORKER_URL = 'https://gemini-live-proxy.ahmadsobhani1993.workers.dev/gemini-generate'
PROXY_SECRET = os.getenv('PROXY_SECRET', '')

#     
TEXT_MODEL_CHAIN = [
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.6-flash'
]

#        env 
def load_gemini_keys():
  keys = []
  env_paths = ['/app/.env', '/app/.env.production', '/app/.env.local']
  for path in env_paths:
    if os.path.exists(path):
      with open(path, 'r', encoding='utf-8') as f:
        for line in f:
          line = line.strip()
          if line.startswith('GEMINI_API_KEY') and '=' in line:
            _, val = line.split('=', 1)
            val = val.strip().strip('"').strip("'")
            if val and val not in keys:
              keys.append(val)
  return keys

GEMINI_KEYS = load_gemini_keys()

FEEDS = [
  #  (News)
  {'name': 'TechCrunch', 'url': 'https://techcrunch.com/category/artificial-intelligence/feed/', 'tagFa': '', 'tagEn': 'News'},
  {'name': 'The Verge', 'url': 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', 'tagFa': '', 'tagEn': 'News'},
  {'name': 'The Rundown', 'url': 'https://www.therundown.ai/feed', 'tagFa': '', 'tagEn': 'News'},
  {'name': 'Bens Bites', 'url': 'https://www.bensbites.co/feed', 'tagFa': '', 'tagEn': 'News'},
  #  (Articles)
  {'name': 'VentureBeat', 'url': 'https://venturebeat.com/category/ai/feed/', 'tagFa': '', 'tagEn': 'Articles'},
  {'name': 'Ars Technica', 'url': 'https://arstechnica.com/tag/ai/feed/', 'tagFa': '', 'tagEn': 'Articles'},
  {'name': 'Maginative', 'url': 'https://www.maginative.com/rss/', 'tagFa': '', 'tagEn': 'Articles'},
  {'name': 'Prompt Engineering Daily', 'url': 'https://feed.bitefeed.co/prompt-engineering-daily', 'tagFa': '', 'tagEn': 'Articles'}
]

def call_gemini_cascade(title, body):
  if not GEMINI_KEYS:
    print(":   GEMINI_API_KEY  .")
    return None

  source_text = f"Title: {title}\n\nBody:\n{body[:7000]}"
  instruction = (
    "You are a bilingual technology-news editor. Write a new, accurate, original article in Persian and English based only on the source facts below.\n\n"
    "Do not translate sentence by sentence or copy the source's phrasing. Preserve names, dates, numbers, uncertainty, and attribution. Do not invent facts, quotations, or claims. Clearly distinguish announcements from independently verified results.\n\n"
    "For each language, write a concise headline, a 1-2 sentence summary, and an informative article of about 300-450 words. Use valid semantic HTML for the body: paragraphs, h2/h3 headings, lists, and blockquotes only when useful. Do not include scripts, inline styles, images, or links. Return only the JSON fields in the requested schema.\n\n"
    f"<source>\n{source_text}\n</source>"
  )

  inner_payload = {
    "contents": [
      {
        "parts": [
          {"text": instruction}
        ]
      }
    ],
    "generationConfig": {
      "responseMimeType": "application/json",
      "temperature": 0.2,
      "responseSchema": {
        "type": "OBJECT",
        "properties": {
          "titleFa": {"type": "STRING"},
          "titleEn": {"type": "STRING"},
          "descFa": {"type": "STRING"},
          "descEn": {"type": "STRING"},
          "contentFa": {"type": "STRING"},
          "contentEn": {"type": "STRING"}
        },
        "required": ["titleFa", "titleEn", "descFa", "descEn", "contentFa", "contentEn"]
      }
    }
  }

  #       
  for model in TEXT_MODEL_CHAIN:
    for key in GEMINI_KEYS:
      body_payload = {
        "model": model,
        "apiKey": key,
        "payload": inner_payload
      }
      headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {PROXY_SECRET}"
      }
      try:
        res = requests.post(WORKER_URL, json=body_payload, headers=headers, timeout=45)
        if res.status_code == 200:
          data = res.json()
          candidates = data.get('candidates', [])
          if candidates:
            raw_text = candidates[0].get('content', {}).get('parts', [{}])[0].get('text', '')
            clean = re.sub(r'^```(?:json)?\s*', '', raw_text.strip(), flags=re.I)
            clean = re.sub(r'\s*```$', '', clean)
            print(f"     : {model}")
            return json.loads(clean)
        else:
          continue
      except Exception:
        continue

  return None

def extract_image(entry, page_url):
  if 'media_content' in entry and len(entry.media_content) > 0:
    return entry.media_content[0].get('url')
  if 'media_thumbnail' in entry and len(entry.media_thumbnail) > 0:
    return entry.media_thumbnail[0].get('url')
  if 'enclosures' in entry and len(entry.enclosures) > 0:
    for enc in entry.enclosures:
      if 'image' in enc.get('type', ''):
        return enc.get('href')

  raw_html = entry.get('summary', '') or entry.get('description', '')
  if 'content' in entry and len(entry.content) > 0:
    raw_html += entry.content[0].get('value', '')
  if raw_html:
    soup = BeautifulSoup(raw_html, 'html.parser')
    img = soup.find('img')
    if img and img.get('src'):
      src = img['src']
      if not src.endswith('.gif') and '1x1' not in src:
        return src

  try:
    res = requests.get(page_url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=5)
    if res.ok:
      soup = BeautifulSoup(res.text, 'html.parser')
      og_img = soup.find('meta', property='og:image')
      if og_img and og_img.get('content'):
        return og_img['content']
  except Exception:
    pass

  return 'https://promptfa.s3.eu-west1.arvanstorage.ir/promptsfa/default-cover.jpg'

def clean_html(text):
  if not text:
    return ''
  soup = BeautifulSoup(text, 'html.parser')
  return soup.get_text().strip()

def run():
  print(f"[{datetime.now()}]    {len(GEMINI_KEYS)}     ...")
  for src in FEEDS:
    try:
      feed = feedparser.parse(src['url'])
      print(f"\n---  : {src['name']} ({src['tagEn']}) ---")

      for entry in feed.entries[:2]:
        title_en = entry.title
        clean_slug_base = re.sub(r'[^a-z0-9\s-]', '', title_en.lower()).strip()
        clean_slug_base = re.sub(r'\s+', '-', clean_slug_base)[:50]

        #   
        check = supabase.table('Article').select('id').ilike('slug', f"{clean_slug_base}%").execute()
        if check.data:
          print(f"  : {title_en[:35]}")
          continue

        raw_body = entry.get('summary', '') or entry.get('description', '')
        if 'content' in entry and len(entry.content) > 0:
          raw_body = entry.content[0].get('value', raw_body)
        body = clean_html(raw_body)
        if len(body) < 120:
          continue

        print(f"  Gemini Cascade ({src['name']}): {title_en[:35]}...")
        gen = call_gemini_cascade(title_en, body)
        if not gen:
          print("     .")
          continue

        page_url = entry.get('link', '')
        img_url = extract_image(entry, page_url)
        now = datetime.utcnow()
        date_str = now.strftime('%B %d, %Y')
        slug = f"{clean_slug_base}-{uuid.uuid4().hex[:4]}"

        source_notice_fa = f"<p><strong>:</strong> <a href='{page_url}' target='_blank' rel='noopener noreferrer'>{src['name']}</a>.      .</p>"
        source_notice_en = f"<p><strong>Source:</strong> <a href='{page_url}' target='_blank' rel='noopener noreferrer'>{src['name']}</a>. Rewritten and translated for PromptsFA.</p>"

        content_fa = f"{gen.get('contentFa', '')}\n{source_notice_fa}"
        content_en = f"{gen.get('contentEn', '')}\n{source_notice_en}"

        payload = {
          'id': f"art_{uuid.uuid4().hex[:12]}",
          'slug': slug,
          'status': 'PUBLISHED',
          'titleEn': gen.get('titleEn', title_en).strip(),
          'titleFa': gen.get('titleFa', title_en).strip(),
          'descEn': gen.get('descEn', body[:220]).strip(),
          'descFa': gen.get('descFa', '').strip(),
          'contentEn': [content_en],
          'contentFa': [content_fa],
          'img': img_url,
          'tagEn': src['tagEn'],
          'tagFa': src['tagFa'],
          'dateEn': date_str,
          'dateFa': date_str,
          'readEn': '3 min read',
          'readFa': '  ',
          'createdAt': now.isoformat()
        }

        supabase.table('Article').insert(payload).execute()
        print(f"    : {payload['titleFa'][:40]}")

    except Exception as e:
      print(f"  {src['name']}: {e}")

if __name__ == '__main__':
  run()
