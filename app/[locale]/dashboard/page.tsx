import { ProjectLibrary } from "@/app/components/ProjectLibrary";

export default function Page(props: {params: Promise<{locale: string}>; searchParams: Promise<{checkout?: string}>}) {
  return <ProjectLibrary {...props} home />;
}
