
import { useState, useEffect } from "react";
import {
  type ToastActionElement,
  ToastProps
} from "@/components/ui/toast";

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 1000000;

export type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
      id: string;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      id: string;
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      id: string;
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: actionTypes.REMOVE_TOAST,
      id: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case actionTypes.ADD_TOAST:
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case actionTypes.UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.id ? { ...t, ...action.toast } : t
        ),
      };

    case actionTypes.DISMISS_TOAST: {
      const { id } = action;

      // First mark as dismissed
      if (id) {
        addToRemoveQueue(id);
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === id || id === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      };
    }

    case actionTypes.REMOVE_TOAST:
      if (action.id === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.id),
      };
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

export function useToast() {
  const [state, setState] = useState<State>(memoryState);

  useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast: {
      dismiss: (toastId?: string) => {
        dispatch({
          type: actionTypes.DISMISS_TOAST,
          id: toastId || "",
        });
      },
      custom: (props: Omit<ToasterToast, "id">) => {
        const id = genId();
        const toast = { id, ...props };
        dispatch({
          type: actionTypes.ADD_TOAST,
          toast,
        });

        return {
          id: toast.id,
          dismiss: () => dispatch({ type: actionTypes.DISMISS_TOAST, id: toast.id }),
          update: (props: ToasterToast) =>
            dispatch({
              type: actionTypes.UPDATE_TOAST,
              id: toast.id,
              toast: props,
            }),
        };
      },
    },
  };
}

export const toast = {
  success: (title: string, options?: Partial<ToasterToast>) => {
    const id = genId();
    dispatch({
      type: actionTypes.ADD_TOAST,
      toast: {
        id,
        variant: "default",
        title,
        ...options,
      },
    });
    console.log("Success toast:", title, options);
    return id;
  },
  error: (title: string, options?: Partial<ToasterToast>) => {
    const id = genId();
    dispatch({
      type: actionTypes.ADD_TOAST,
      toast: {
        id,
        variant: "destructive",
        title,
        ...options,
      },
    });
    console.log("Error toast:", title, options);
    return id;
  },
  info: (title: string, options?: Partial<ToasterToast>) => {
    const id = genId();
    dispatch({
      type: actionTypes.ADD_TOAST,
      toast: {
        id,
        title,
        ...options,
      },
    });
    console.log("Info toast:", title, options);
    return id;
  },
  warning: (title: string, options?: Partial<ToasterToast>) => {
    const id = genId();
    dispatch({
      type: actionTypes.ADD_TOAST,
      toast: {
        id,
        title,
        ...options,
      },
    });
    console.log("Warning toast:", title, options);
    return id;
  },
};
