import { AutoFormEventEmitter } from "@/lib/events";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  // useState,
} from "react";

type AutoFormContextType = {
  addEventListener: (eventName: string, callback: Function) => () => void;
  triggerEvent: (eventName: string, data: any) => void;
  cleanup: () => void;
};

const AutoFormContext = createContext<AutoFormContextType | undefined>(
  undefined,
);

// Hook to access the context
export const useAutoFormContext = () => {
  const context = useContext(AutoFormContext);
  if (!context) {
    throw new Error(
      "useAutoFormContext must be used within an AutoFormProvider",
    );
  }
  return context;
};

// Hook for listening to auto form events
export const useAutoFormListener = (eventName: string, callback: Function) => {
  const { addEventListener } = useAutoFormContext();

  useEffect(() => {
    const unsubscribe = addEventListener(eventName, callback);
    return unsubscribe;
  }, [eventName, addEventListener]);
};

// Hook for triggering auto form events
export const useAutoFormTrigger = () => {
  const { triggerEvent /*, getAllForms, getForm*/ } = useAutoFormContext();

  return {
    trigger: triggerEvent,
    // getAllForms,
    // getForm
  };
};

export type AutoFormProviderProps = {
  children?: React.ReactNode;
};

export const useAutoForm = (/*formId, initialData = {}*/) => {
  const { /*registerForm, unregisterForm,*/ triggerEvent } =
    useAutoFormContext();
  //   const [formData, setFormData] = useState(initialData);
  //   const [errors, setErrors] = useState({});
  //   const [isSubmitting, setIsSubmitting] = useState(false);

  //   // Register this form with the context
  //   useEffect(() => {
  //     const formState = {
  //       formData,
  //       errors,
  //       isSubmitting,
  //       setFormData,
  //       setErrors,
  //       setIsSubmitting
  //     };

  //     registerForm(formId, formState);

  //     return () => {
  //       unregisterForm(formId);
  //     };
  //   }, [formId, formData, errors, isSubmitting, registerForm, unregisterForm]);

  // Listen for form events specific to this form

  //   useAutoFormListener(`reset`, () => {
  //     // setFormData(initialData);
  //     // setErrors({});
  //     // setIsSubmitting(false);
  //   });

  //   useAutoFormListener(`form:${formId}:set-errors`, (newErrors) => {
  //     setErrors(newErrors);
  //   }, [formId]);

  //   useAutoFormListener(`form:${formId}:validate`, (validationRules) => {
  //     const newErrors = {};
  //     Object.keys(validationRules).forEach(field => {
  //       const rule = validationRules[field];
  //       const value = formData[field];

  //       if (rule.required && (!value || value.toString().trim() === '')) {
  //         newErrors[field] = `${field} is required`;
  //       }

  //       if (rule.minLength && value && value.length < rule.minLength) {
  //         newErrors[field] = `${field} must be at least ${rule.minLength} characters`;
  //       }

  //       if (rule.pattern && value && !rule.pattern.test(value)) {
  //         newErrors[field] = rule.message || `${field} format is invalid`;
  //       }
  //     });

  //     setErrors(newErrors);

  //     // Emit validation result
  //     triggerEvent(`form:${formId}:validation-result`, {
  //       isValid: Object.keys(newErrors).length === 0,
  //       errors: newErrors
  //     });
  //   }, [formId, formData, triggerEvent]);

  //   // Listen for global form events
  //   useAutoFormListener('form:global:reset-all', () => {
  //     setFormData(initialData);
  //     setErrors({});
  //     setIsSubmitting(false);
  //   }, [initialData]);

  //   useAutoFormListener('form:global:clear-errors', () => {
  //     setErrors({});
  //   }, []);

  //   const updateField = useCallback((fieldName, value) => {
  //     setFormData(prev => ({ ...prev, [fieldName]: value }));
  //     // Clear error for this field when updating
  //     if (errors[fieldName]) {
  //       setErrors(prev => ({ ...prev, [fieldName]: undefined }));
  //     }

  //     // Emit field update event
  //     triggerEvent(`form:${formId}:field-updated`, { fieldName, value });
  //   }, [errors, formId, triggerEvent]);

  //   const submitForm = useCallback(async (onSubmit) => {
  //     setIsSubmitting(true);
  //     try {
  //       // Emit pre-submit event
  //       triggerEvent(`form:${formId}:pre-submit`, formData);

  //       const result = await onSubmit(formData);

  //       // Emit success event
  //       triggerEvent(`form:${formId}:submit-success`, {
  //         formData,
  //         result
  //       });

  //       // Emit global success event
  //       triggerEvent('form:global:submit-success', {
  //         formId,
  //         formData,
  //         result
  //       });

  //       return result;
  //     } catch (error) {
  //       // Emit error event
  //       triggerEvent(`form:${formId}:submit-error`, {
  //         formData,
  //         error
  //       });

  //       // Emit global error event
  //       triggerEvent('form:global:submit-error', {
  //         formId,
  //         formData,
  //         error
  //       });

  //       throw error;
  //     } finally {
  //       setIsSubmitting(false);
  //     }
  //   }, [formData, formId, triggerEvent]);

  const resetForm = useCallback(() => {
    triggerEvent(`reset`, () => {});
  }, [triggerEvent]);

  return {
    // formData,
    // errors,
    // isSubmitting,
    // updateField,
    // submitForm,
    resetForm,
    // setFormData,
    // setErrors
  };
};

export const AutoFormProvider = ({
  children,
}: AutoFormProviderProps): React.JSX.Element => {
  const emitterRef = useRef(new AutoFormEventEmitter());

  // Event listener function
  const addEventListener = useCallback(
    (eventName: string, callback: Function) => {
      const unsubscribe = emitterRef.current.on(eventName, callback);
      return unsubscribe;
    },
    [],
  );

  // Event trigger function
  const triggerEvent = useCallback((eventName: string, data: any) => {
    emitterRef.current.emit(eventName, data);
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    emitterRef.current.clear();
  }, []);

  const contextValue = {
    addEventListener,
    triggerEvent,
    // registerForm,
    // unregisterForm,
    // getAllForms,
    // getForm,
    cleanup,
  };

  return (
    <AutoFormContext.Provider value={contextValue}>
      {children}
    </AutoFormContext.Provider>
  );
};
