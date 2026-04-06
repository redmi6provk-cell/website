"use client";

import { useRef, useState } from "react";
import api from "@/lib/api";
import { Button } from "./Button";

interface ImageUploaderProps {
  value: string;
  onUploaded: (url: string) => void;
  label?: string;
}

export default function ImageUploader({ value, onUploaded, label = "Upload from computer" }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await api.post("/admin/uploads/image", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      onUploaded(response.data.data.url);
    } catch (error: any) {
      setUploadError(error?.response?.data?.error || "Image upload failed.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          className="rounded-2xl"
          isLoading={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          {label}
        </Button>
        {value && (
          <span className="text-xs font-medium text-green-700">Image ready to use</span>
        )}
      </div>
      {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
    </div>
  );
}
