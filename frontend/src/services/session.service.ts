import apiClient from './api.client'
import type { Session, UploadSessionResponse } from '../types'

/**
 * Upload a recorded audio blob and create a new session.
 * Returns the session_id immediately — analysis runs async.
 */
export async function uploadSession(
  audioBlob: Blob,
  topicId: string,
  topicText: string
): Promise<UploadSessionResponse> {
  const formData = new FormData()
  formData.append('audio', audioBlob, 'recording.webm')
  formData.append('topic_id', topicId)
  formData.append('topic_text', topicText)

  const { data } = await apiClient.post<UploadSessionResponse>(
    '/sessions/upload',
    formData
  )
  return data
}

/**
 * Fetch a single session by ID.
 */
export async function getSession(sessionId: string): Promise<Session> {
  const { data } = await apiClient.get<Session>(`/sessions/${sessionId}`)
  return data
}

/**
 * Fetch all sessions for the current user.
 */
export async function getUserSessions(): Promise<Session[]> {
  const { data } = await apiClient.get<Session[]>('/sessions')
  return data
}
