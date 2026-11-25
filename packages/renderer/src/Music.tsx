export function Music({ provider, id, autoplay }: { provider: "youtube" | "spotify"; id: string; autoplay: boolean }) {
  if (provider === "youtube") {
    const src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=${autoplay ? 1 : 0}&loop=1&playlist=${id}&playsinline=1`;
    return (
      <iframe
        className="mfy-music mfy-music-yt"
        title="Background music"
        src={src}
        allow="autoplay; encrypted-media"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
      />
    );
  }
  return (
    <iframe
      className="mfy-music mfy-music-sp"
      title="Background music"
      src={`https://open.spotify.com/embed/track/${id}`}
      allow="encrypted-media"
      sandbox="allow-scripts allow-same-origin allow-presentation"
      referrerPolicy="strict-origin-when-cross-origin"
      loading="lazy"
    />
  );
}
