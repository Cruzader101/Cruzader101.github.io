This is an example post. It exists to show what the formatting looks like — delete it
and write something real.

Posts are plain Markdown files in `posts/`. To publish one, drop the file in that folder
and add an entry to the `posts` array in `data/site.json`. The filename has to match the
slug, so `posts/hello.md` pairs with `"slug": "hello"`.

## What renders

Headings, **bold**, *italic*, and `inline code` all work. So do links, like
[the repo this site describes](https://github.com/Cruzader101). Lists work too:

- Unordered lists
- Ordered lists, if you number them
- Nested lists do not — the renderer is deliberately small

Fenced code blocks keep their whitespace:

```cpp
Vec3 reflect(const Vec3& v, const Vec3& n) {
    return v - n * (2.0f * dot(v, n));
}
```

> Blockquotes look like this. Useful for pulling out a line from something you read.

Images go in with normal Markdown syntax and get a border automatically:
`![alt text](img/projects/example.png)`. Write real alt text — it is what a screen
reader announces, and what shows if the file goes missing.

---

One thing worth knowing: the renderer escapes HTML rather than passing it through, so
typing `<script>` into a post shows those characters as text. That is on purpose.
