import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Search, Settings, Trash2, Upload, Users } from "lucide-react";


export function SideBar({ onUploadClick }: { onUploadClick: () => void }) {
    const actionItems = useMemo(() => [
        {
            label: "Upload",
            icon: Upload,
            onClick: () => {
                console.log("Upload");
                onUploadClick();
            }
        },
        {
            label: "Search",
            icon: Search,
            onClick: () => {
                console.log("Search");
            }
        },
        {
            label: "Settings",
            icon: Settings,
            onClick: () => {
                console.log("Settings");
            }
        }
    ], []);

    const navigationItems = useMemo(() => [
        {
            label: "My Drive",
            icon: FileText,
            onClick: () => {
                console.log("My Drive");
            }
        },
        {
            label: "Shared with me",
            icon: Users,
            onClick: () => {
                console.log("Shared with me");
            }
        },
        {
            label: "Trash",
            icon: Trash2,
            onClick: () => {
                console.log("Trash");
            }
        }
    ], []);

    return (
        <div className="w-64 border-r border-gray-200 bg-white flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded bg-green-500 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <div className="text-base font-semibold text-gray-900 tracking-tight">Drive</div>
                        <div className="text-xs text-gray-500 font-normal mt-0.5">johnwork's workspace</div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="p-4 space-y-2">
                {actionItems.map((item) => (
                    <Button
                        key={item.label}
                        variant="ghost"
                        className="w-full justify-start text-gray-700 hover:bg-gray-50"
                        onClick={item.onClick}
                    >
                        <item.icon className="w-4 h-4 mr-2" />
                        {item.label}
                    </Button>
                ))}
            </div>

            {/* Navigation */}

            <div className="flex-1 px-4 space-y-1">
                {navigationItems.map((item) => (
                    <Button
                        key={item.label}
                        variant="ghost"
                        className="w-full justify-start text-gray-700 hover:bg-gray-50"
                        onClick={item.onClick}
                    >
                        <item.icon className="w-4 h-4 mr-2" />
                        {item.label}
                    </Button>
                ))}

            </div>
        </div>
    );
}