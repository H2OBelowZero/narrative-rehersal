import { ProjectStack } from '@/components/project-stack';

/** A deep link to a script still has the scripts board underneath to go back to. */
export const unstable_settings = { anchor: 'index' };

/** Routes: index (every script in the project) and [scriptId], the page you write on. */
export default function WriteLayout() {
  return <ProjectStack title="Write" />;
}
