import React from 'react'

const defaultLabels = {
  plural: '条',
  singular: '条',
}

const defaultCollectionLabels = {
  posts: {
    plural: '篇',
    singular: '篇',
  },
}

export const PageRange: React.FC<{
  className?: string
  collection?: keyof typeof defaultCollectionLabels
  collectionLabels?: {
    plural?: string
    singular?: string
  }
  currentPage?: number
  limit?: number
  totalDocs?: number
}> = (props) => {
  const {
    className,
    collection,
    collectionLabels: collectionLabelsFromProps,
    currentPage,
    limit,
    totalDocs,
  } = props

  let indexStart = (currentPage ? currentPage - 1 : 1) * (limit || 1) + 1
  if (totalDocs && indexStart > totalDocs) indexStart = 0

  let indexEnd = (currentPage || 1) * (limit || 1)
  if (totalDocs && indexEnd > totalDocs) indexEnd = totalDocs

  const { singular } =
    collectionLabelsFromProps ||
    (collection ? defaultCollectionLabels[collection] : undefined) ||
    defaultLabels ||
    {}

  return (
    <div className={[className, 'font-semibold'].filter(Boolean).join(' ')}>
      {(typeof totalDocs === 'undefined' || totalDocs === 0) && '没有找到文章'}
      {typeof totalDocs !== 'undefined' &&
        totalDocs > 0 &&
        `第 ${indexStart}${indexStart > 0 ? `–${indexEnd}` : ''} ${singular}，共 ${totalDocs} ${singular}`}
    </div>
  )
}
