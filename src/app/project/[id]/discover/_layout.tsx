import { ProjectStack } from '@/components/project-stack';

/** A deep link to screenplay/[draftId] still has the Discover index underneath to go back to. */
export const unstable_settings = { anchor: 'index' };

/** Routes: index (Discoveries | Screenplay | Branches) and screenplay/[draftId], which sets its own header options. */
export default function DiscoverLayout() {
  return <ProjectStack title="Discover" />;
}
