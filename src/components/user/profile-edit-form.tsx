"use client";

import type React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Upload, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { userController, type User } from "@/controller/userController";
import { useToast } from "@/hook/use-toast";
import { cn } from "@/lib/utils";

// Form validation schema
const profileFormSchema = z.object({
  username: z
    .string()
    .min(3, {
      message: "Username must be at least 3 characters.",
    })
    .max(30, {
      message: "Username must not be longer than 30 characters.",
    }),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  location: z.string().optional(),
  about: z.string().optional(),
  bio: z
    .string()
    .max(160, {
      message: "Bio must not be longer than 160 characters.",
    })
    .optional(),
  website: z
    .string()
    .url({
      message: "Please enter a valid URL.",
    })
    .optional()
    .or(z.literal("")),
  birthdate: z.date().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface ProfileEditFormProps {
  user: User;
  onClose: () => void;
  onUpdate: (user: User) => void;
}

export default function ProfileEditForm({
  user,
  onClose,
  onUpdate,
}: ProfileEditFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(
    user?.profile?.pfp || null
  );

  // Initialize form with user data
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      username: user?.username || "",
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      location: user?.location || "",
      about: user?.about || "",
      bio: user?.profile?.bio || "",
      website: user?.profile?.website || "",
      birthdate: user?.profile?.birthdate
        ? new Date(user.profile.birthdate)
        : undefined,
    },
  });

  // Handle profile image change
  const handleImageChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      if (!user || !user.id) {
        toast({
          title: "Error",
          description: "User data is missing. Please try again.",
          variant: "destructive",
        });
        return;
      }

      const file = e.target.files[0];

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "Image size must be less than 5MB",
          variant: "destructive",
        });
        return;
      }

      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Error",
          description: "Only image files are allowed",
          variant: "destructive",
        });
        return;
      }

      setProfileImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload image immediately
      try {
        setUploadingImage(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "profile");

        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: formData,
          headers: {
            "x-user-id": user.id,
            "x-user-username": user.username,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload profile image");
        }

        const uploadResult = await uploadResponse.json();
        const imageUrl = uploadResult.url || uploadResult.data?.url;

        if (!imageUrl) {
          throw new Error("No image URL returned from server");
        }

        // Update preview with the actual URL from server
        setProfileImagePreview(imageUrl);

        toast({
          title: "Success",
          description: "Profile image uploaded successfully",
        });
      } catch (error) {
        console.error("Error uploading profile image:", error);
        toast({
          title: "Error",
          description: "Failed to upload profile image. Please try again.",
          variant: "destructive",
        });
        // Revert to previous image if upload fails
        setProfileImagePreview(user.profile?.pfp || null);
        setProfileImage(null);
      } finally {
        setUploadingImage(false);
      }
    },
    [toast, user]
  );

  // Handle form submission
  const onSubmit = useCallback(
    async (data: ProfileFormValues) => {
      if (!user || !user.id) {
        toast({
          title: "Error",
          description: "User data is missing. Please try again.",
          variant: "destructive",
        });
        return;
      }

      setIsSubmitting(true);

      try {
        // Prepare profile data
        const profileData: Partial<User> = {
          username: data.username,
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          location: data.location || "",
          about: data.about || "",
          profile: {
            bio: data.bio || null,
            website: data.website || null,
            birthdate: data.birthdate ? data.birthdate.toISOString() : null,
            pfp: profileImagePreview, // Use the already uploaded image URL
          },
        };

        // Update user profile using the controller
        const updatedUser = await userController.updateProfile(
          user.id,
          profileData
        );

        if (!updatedUser) {
          throw new Error("Failed to update profile");
        }

        toast({
          title: "Success",
          description: "Profile updated successfully",
        });

        onUpdate(updatedUser);
      } catch (error) {
        console.error("Error updating profile:", error);
        toast({
          title: "Error",
          description: "Failed to update profile. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [onUpdate, profileImagePreview, toast, user]
  );

  if (!user) {
    return null;
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your profile information. Click save when you're done.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Profile Picture */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Avatar className="w-24 h-24 border-2 border-white shadow-md">
                  <AvatarImage
                    src={profileImagePreview || "/placeholder-user.jpg"}
                    alt={user.username}
                  />
                  <AvatarFallback className="text-2xl">
                    {user.username.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {uploadingImage && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingImage}
                  className="flex items-center gap-1"
                  onClick={() =>
                    document.getElementById("profile-image-input")?.click()
                  }
                >
                  {uploadingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1" />
                  )}
                  {uploadingImage ? "Uploading..." : "Change Photo"}
                </Button>
                <input
                  id="profile-image-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                  disabled={uploadingImage}
                />

                {profileImagePreview &&
                  profileImagePreview !== user.profile?.pfp && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setProfileImage(null);
                        setProfileImagePreview(user.profile?.pfp || null);
                      }}
                      disabled={uploadingImage}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  )}
              </div>
              <FormDescription className="text-center text-xs">
                Recommended: Square image, max 5MB
              </FormDescription>
            </div>

            {/* Username */}
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    This is your public display name.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Name */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Bio */}
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Tell us about yourself"
                      className="resize-none"
                      value={field.value || ""}
                      maxLength={160}
                    />
                  </FormControl>
                  <FormDescription>
                    {field.value?.length || 0}/160 characters
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Website */}
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="https://example.com"
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Your personal or professional website
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Location */}
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="City, Country"
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Birthdate */}
            <FormField
              control={form.control}
              name="birthdate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date of Birth</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Your date of birth is used to calculate your age.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* About */}
            <FormField
              control={form.control}
              name="about"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>About</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Share more details about yourself"
                      className="resize-none"
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Form Actions */}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || uploadingImage}
                className="min-w-[100px]"
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
