import { replacePostTags } from "@/db/post-taxonomy-queries"
import { apiError, apiSuccess, createAdminRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { getRequestIp, writeAdminLog } from "@/lib/admin"
import { revalidateUpdatedPostMutation } from "@/lib/content-mutation-revalidation"
import { ensureCanManagePost } from "@/lib/moderator-permissions"

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const postId = requireStringField(body, "postId", "缺少帖子标识")
  const rawTags = body.tags

  if (!Array.isArray(rawTags) || rawTags.some((item) => typeof item !== "string")) {
    apiError(400, "标签格式不正确")
  }

  const post = await ensureCanManagePost(adminUser, postId)
  const result = await replacePostTags(post.id, rawTags)
  const requestIp = getRequestIp(request)

  await writeAdminLog(
    adminUser.id,
    "post.tags.update",
    "POST",
    post.id,
    `更新帖子标签：${result.tags.map((tag) => tag.name).join("、") || "清空标签"}`,
    requestIp,
  )

  revalidateUpdatedPostMutation({
    postId: post.id,
    postSlug: post.slug,
    boardSlug: post.board.slug,
    zoneSlug: post.board.zone?.slug,
    authorId: post.authorId,
    affectedTagSlugs: result.affectedTagSlugs,
  })

  return apiSuccess({ tags: result.tags }, "标签已更新")
}, {
  allowModerator: true,
  errorMessage: "更新标签失败",
  logPrefix: "[api/admin/posts/tags] unexpected error",
})
