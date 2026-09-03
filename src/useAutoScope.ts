import { useEffect, useRef, useState } from "react";
import { resolveScope } from "./api";
import { isScopeFieldEmpty } from "../shared/extractScope";

const DEBOUNCE_MS = 700;

type ScopeSetters = {
  repo: string;
  branchName: string;
  setRepo: (value: string) => void;
  setBranchName: (value: string) => void;
};

export function useAutoScopeFromText(
  text: string,
  { repo, branchName, setRepo, setBranchName }: ScopeSetters,
) {
  const resolvingRef = useRef(0);
  const repoRef = useRef(repo);
  const branchRef = useRef(branchName);
  const userEditedRepo = useRef(false);
  const userEditedBranch = useRef(false);
  const lastScopedTextRef = useRef("");
  const [resolving, setResolving] = useState(false);
  const [debouncedText, setDebouncedText] = useState(text);

  const scopeIncomplete = isScopeFieldEmpty(repo) || isScopeFieldEmpty(branchName);

  useEffect(() => {
    repoRef.current = repo;
  }, [repo]);

  useEffect(() => {
    branchRef.current = branchName;
  }, [branchName]);

  useEffect(() => {
    if (text.trim()) return;
    lastScopedTextRef.current = "";
    userEditedRepo.current = false;
    userEditedBranch.current = false;
    setRepo("");
    setBranchName("");
    setResolving(false);
    setDebouncedText("");
  }, [text, setRepo, setBranchName]);

  useEffect(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const timer = window.setTimeout(() => setDebouncedText(text), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    const trimmed = debouncedText.trim();
    if (!trimmed) {
      setResolving(false);
      return;
    }

    const textChanged = trimmed !== lastScopedTextRef.current;
    const scopeIncompleteNow =
      isScopeFieldEmpty(repoRef.current) || isScopeFieldEmpty(branchRef.current);

    if (!textChanged && !scopeIncompleteNow) {
      setResolving(false);
      return;
    }

    if (textChanged) {
      userEditedRepo.current = false;
      userEditedBranch.current = false;
      setRepo("");
      setBranchName("");
    }

    const requestId = ++resolvingRef.current;
    let cancelled = false;
    setResolving(true);

    const timer = window.setTimeout(() => {
      void resolveScope(trimmed)
        .then((resolved) => {
          if (cancelled || requestId !== resolvingRef.current) return;
          if (!userEditedRepo.current && resolved.repo) setRepo(resolved.repo);
          if (!userEditedBranch.current && resolved.branchName) setBranchName(resolved.branchName);
          lastScopedTextRef.current = trimmed;
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled && requestId === resolvingRef.current) setResolving(false);
        });
    }, textChanged ? 0 : DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (requestId === resolvingRef.current) setResolving(false);
    };
  }, [debouncedText, scopeIncomplete, setRepo, setBranchName]);

  const pendingNewScope =
    debouncedText.trim() !== "" && debouncedText.trim() !== lastScopedTextRef.current;

  return {
    resolving: resolving && (scopeIncomplete || pendingNewScope),
    markRepoEdited: () => {
      userEditedRepo.current = true;
    },
    markBranchEdited: () => {
      userEditedBranch.current = true;
    },
  };
}
