"use client";
import { AuthGuard } from "@/components/guards/auth-guard";
import { ProfilePage as ProfilePageView } from "@/components/profile-page";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();

  return (
    <AuthGuard>
      <div className="flex flex-col h-screen bg-background">
        <ProfilePageView onBack={() => router.push("/")} />
      </div>
    </AuthGuard>
  );
}
