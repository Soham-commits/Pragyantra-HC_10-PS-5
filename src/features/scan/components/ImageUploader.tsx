import { useState, useCallback } from "react";
import { Upload, X, Image, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils";

interface ImageUploaderProps {
  onImageSelect: (file: File) => void;
  selectedImage: File | null;
  onClear: () => void;
}

export function ImageUploader({ onImageSelect, selectedImage, onClear }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files[0]) {
        handleFile(files[0]);
      }
    },
    [onImageSelect]
  );

  const handleFile = (file: File) => {
    if (file.type.startsWith("image/")) {
      onImageSelect(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleClear = () => {
    setPreview(null);
    onClear();
  };

  if (selectedImage && preview) {
    return (
      <div className="relative rounded-2xl overflow-hidden border border-border/50 bg-card animate-scale-in">
        <img
          src={preview}
          alt="Selected scan"
          className="w-full h-64 object-contain bg-muted/50"
        />
        <div className="absolute top-3 right-3">
          <Button
            variant="secondary"
            size="icon"
            onClick={handleClear}
            className="h-8 w-8 rounded-full bg-card/90 backdrop-blur-sm"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-3">
            <FileImage className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedImage.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedImage.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={cn(
        "relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300 cursor-pointer",
        isDragging
          ? "border-primary bg-primary-light"
          : "border-border hover:border-primary/50 hover:bg-muted/50"
      )}
    >
      <input
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-2xl transition-colors",
            isDragging ? "bg-primary/20" : "bg-muted"
          )}
        >
          {isDragging ? (
            <Image className="h-8 w-8 text-primary" />
          ) : (
            <Upload className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div>
          <p className="text-base font-medium">
            {isDragging ? "Drop your scan here" : "Upload Medical Scan"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Drag and drop or click to browse
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Supports X-ray, MRI, CT scans, and dermoscopic images
          </p>
        </div>
      </div>
    </div>
  );
}

