export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Canonical host: redirect www.shippie.dev -> shippie.dev (keep path + query).
    if (url.hostname.startsWith('www.')) {
      url.hostname = url.hostname.slice(4)
      return Response.redirect(url.toString(), 301)
    }

    // Everything else: serve the built SPA assets.
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
