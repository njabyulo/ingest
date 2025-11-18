import { SideBar } from "./SIdeBar";
// import { Outlet } from "react-router-dom";

export function Wrapper({ children, onUploadClick }: { children: React.ReactNode, onUploadClick: () => void }) {
    return (
        <div className="flex h-screen bg-white">
            <SideBar onUploadClick={onUploadClick} />
            <div className="flex-1 flex flex-col overflow-hidden">
                {children}
            </div>
        </div>
    );
}