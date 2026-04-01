import { GenericPageSkeleton } from "@/components/skeletons/page-skeletons/generic-skeleton"

export default function EmailComposeLoading() {
  return <GenericPageSkeleton contentType="form" items={5} />
}
