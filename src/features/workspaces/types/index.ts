export type Persona = "creator" | "agency" | "brand";
export type OnboardingState = "workspace" | "channels" | "complete";

export type UserProfile = {
  id: string;
  full_name: string;
  persona: Persona | null;
  onboarding_state: OnboardingState;
  primary_workspace_id: string | null;
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
};
