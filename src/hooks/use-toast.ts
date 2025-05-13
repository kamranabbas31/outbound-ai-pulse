import { useState, useEffect } from "react";
import { useToast as useToastUI } from "@/components/ui/toast";

export function useToast() {
  return useToastUI();
}

export const toast = {
  success: (title: string, options?: any) => {
    console.log("Success toast:", title, options);
    // Implementation using the underlying toast mechanism
  },
  error: (title: string, options?: any) => {
    console.log("Error toast:", title, options);
    // Implementation using the underlying toast mechanism
  },
  info: (title: string, options?: any) => {
    console.log("Info toast:", title, options);
    // Implementation using the underlying toast mechanism
  },
  warning: (title: string, options?: any) => {
    console.log("Warning toast:", title, options);
    // Implementation using the underlying toast mechanism
  },
};
