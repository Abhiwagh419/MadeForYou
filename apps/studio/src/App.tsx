import { useEffect } from "react";
import { Editor } from "./editor/Editor";
import { useRoute } from "./lib/router";
import { Dashboard } from "./screens/Dashboard";
import { Guided } from "./screens/Guided";
import { Home } from "./screens/Home";
import { Publish } from "./screens/Publish";
import { Share } from "./screens/Share";
import { TemplateFrom } from "./screens/TemplateFrom";
import { TemplatePreview } from "./screens/TemplatePreview";
import { Templates } from "./screens/Templates";
import { Viewer } from "./screens/Viewer";
import { Toaster } from "./ui/Controls";
import { NotFound } from "./ui/Shell";

export function App() {
  const route = useRoute();

  useEffect(() => {
    window.scrollTo?.(0, 0);
    if (route.name !== "view") document.title = "MadeForYou";
  }, [route.name, route.params.id]);

  let screen;
  switch (route.name) {
    case "home": screen = <Home />; break;
    case "templates": screen = <Templates />; break;
    case "template": screen = <TemplatePreview />; break;
    case "make": screen = <Guided />; break;
    case "edit": screen = <Editor />; break;
    case "publish": screen = <Publish />; break;
    case "share": screen = <Share />; break;
    case "astemplate": screen = <TemplateFrom />; break;
    case "me": screen = <Dashboard />; break;
    case "view": screen = <Viewer />; break;
    default: screen = <NotFound />;
  }
  return (
    <>
      {screen}
      <Toaster />
    </>
  );
}
