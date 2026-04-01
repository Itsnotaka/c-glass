"use client";

import { useEffect, useState } from "react";

import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";

export function GlassProviderKeyDialog(props: {
  open: boolean;
  provider: string;
  onSubmit: (key: string | undefined) => void;
}) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (props.open) setValue("");
  }, [props.open]);

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onSubmit(undefined);
      }}
    >
      <DialogPopup className="max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>API key</DialogTitle>
          <DialogDescription>
            Enter an API key for provider <span className="font-medium">{props.provider}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          <Input
            type="password"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Key"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => props.onSubmit(undefined)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              const v = value.trim();
              props.onSubmit(v.length > 0 ? v : undefined);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
