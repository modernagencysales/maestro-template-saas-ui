import {
  reviewNotifications,
  type ReviewNotification,
} from '#lib/review-fixtures'

export type UpdateNotification = ReviewNotification

export const getReviewNotifications = async () => ({
  notifications: reviewNotifications,
})
