export default {
  fetch() {
    return new Response(null, { status: 404 })
  },
} satisfies ExportedHandler<Env>
