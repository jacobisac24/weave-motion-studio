import { ProjectProvider } from "@/context/ProjectContext";
import { EditorLayout } from "@/components/editor/EditorLayout";

const Index = () => (
  <ProjectProvider>
    <EditorLayout />
  </ProjectProvider>
);

export default Index;
