export default function SetupLayout({ children }) {
    // No header, no sidebar — standalone onboarding layout
    return <>{children}</>;
}
