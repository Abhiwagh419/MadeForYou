import { useEffect } from "react";
import { ClerkProvider, SignIn, useAuth, useUser } from "@clerk/clerk-react";
import { Sheet } from "../ui/Controls";
import { clerkKey } from "./config";

interface Props {
  onState: (s: { ready: boolean; userId: string | null; label: string; getToken: () => Promise<string | null>; signOut: () => void }) => void;
  open: boolean;
  onClose: () => void;
}

function Inner({ onState, open, onClose }: Props) {
  const { isLoaded, isSignedIn, userId, getToken, signOut } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    onState({
      ready: isLoaded,
      userId: isSignedIn ? userId ?? null : null,
      label: user?.primaryEmailAddress?.emailAddress ?? user?.firstName ?? "",
      getToken: async () => (isSignedIn ? getToken() : null),
      signOut: () => void signOut(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, userId, user]);

  useEffect(() => {
    if (isSignedIn && open) onClose();
  }, [isSignedIn, open, onClose]);

  return (
    <Sheet open={open && !isSignedIn} onClose={onClose} title="Sign in to MadeForYou">
      <SignIn routing="virtual" />
    </Sheet>
  );
}

/** Loaded on demand, only when a Clerk key is configured. */
export default function ClerkBridge(props: Props) {
  return (
    <ClerkProvider publishableKey={clerkKey()}>
      <Inner {...props} />
    </ClerkProvider>
  );
}
