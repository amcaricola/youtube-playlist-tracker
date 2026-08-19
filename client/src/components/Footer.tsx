export default function Footer() {
  return (
    <footer class="border-t border-surface-800 bg-surface-950 px-4 py-6">
      <div class="mx-auto flex max-w-6xl flex-col gap-2 text-xs text-gray-500">
        <p>
          Esta aplicación usa la{' '}
          <a
            href="https://developers.google.com/youtube/v3"
            target="_blank"
            rel="noopener noreferrer"
            class="text-gray-300 underline transition hover:text-white"
          >
            YouTube Data API
          </a>
          . Al usarla, aceptas los{' '}
          <a
            href="https://www.youtube.com/t/terms"
            target="_blank"
            rel="noopener noreferrer"
            class="text-gray-300 underline transition hover:text-white"
          >
            Términos de Servicio de YouTube
          </a>
          . Consulta la{' '}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            class="text-gray-300 underline transition hover:text-white"
          >
            Política de Privacidad de Google
          </a>
          .
        </p>
        <p>
          Los campos de artista y canción son datos propios de esta aplicación, parseados y editables por el usuario,
          y no provienen de YouTube.
        </p>
      </div>
    </footer>
  );
}