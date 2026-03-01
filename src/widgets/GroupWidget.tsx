'use no memo';
import React from 'react';
import type { ColorProp } from 'react-native-android-widget';
import { FlexWidget, ListWidget, TextWidget } from 'react-native-android-widget';
import type { Group, Task } from '../db/schema';
import { truncate, type WidgetThemeColors } from './theme';

interface GroupWidgetProps {
  group: Group;
  tasks: Task[];
  colors: WidgetThemeColors;
}

/**
 * Resolve the correct deep link URI for a task in a group.
 * - "Mapas Mentais" → mind map tool
 * - "Flashcards" → flashcards tool
 * - Otherwise → task preview
 */
function getDeepLinkForTask(task: Task, group: Group): string {
  if (group.name === 'Mapas Mentais') {
    return `genly://tools/mind-map?taskId=${task.id}`;
  }
  if (group.name === 'Flashcards') {
    return `genly://tools/flashcards?taskId=${task.id}`;
  }
  return `genly://task/${task.id}`;
}

export function GroupWidget({ group, tasks, colors }: GroupWidgetProps) {
  const dotColor = (group.color || '#6366f1') as ColorProp;
  const badgeBg = `${dotColor}25` as ColorProp;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: colors.bg,
        borderRadius: 20,
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <FlexWidget
        style={{
          width: 'match_parent',
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 14,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.bgHeader,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          paddingBottom: 12,
        }}
      >
        <TextWidget
          text={group.emoji || '📁'}
          style={{ fontSize: 18, marginRight: 8 }}
        />
        <FlexWidget style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <TextWidget
            text={group.name}
            maxLines={1}
            truncate="END"
            style={{
              width: 'match_parent',
              fontSize: 16,
              fontFamily: 'Montserrat-Bold',
              color: colors.text,
            }}
          />
        </FlexWidget>
        <FlexWidget
          style={{
            backgroundColor: badgeBg,
            borderRadius: 12,
            width: 28,
            height: 28,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          clickAction="OPEN_URI"
          clickActionData={{ 
            uri: group.name === 'Mapas Mentais' 
              ? 'genly://tools/mind-map' 
              : group.name === 'Flashcards' 
                ? 'genly://tools/flashcards' 
                : `genly://task/editor?groupId=${group.id}`
          }}
        >
          <TextWidget
            text="+"
            style={{
              fontSize: 18,
              fontFamily: 'Montserrat-Bold',
              color: dotColor,
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* List Section Wrapper */}
      <FlexWidget
        style={{
          flex: 1,
          width: 'match_parent',
          paddingTop: 8,
          paddingBottom: 8,
        }}
      >
        {tasks.length === 0 ? (
          <FlexWidget
            style={{
              flex: 1,
              width: 'match_parent',
              alignItems: 'center',
              justifyContent: 'center',
              paddingLeft: 20,
              paddingRight: 20,
            }}
          >
            <TextWidget
              text="Nenhum item neste grupo"
              style={{
                fontSize: 14,
                fontFamily: 'Montserrat-Regular',
                color: colors.textSecondary,
              }}
            />
          </FlexWidget>
        ) : (
          <ListWidget
            style={{
              height: 'match_parent',
              width: 'match_parent',
            }}
          >
            {tasks.map((task, index) => (
              <FlexWidget
                key={task.id}
                style={{
                  width: 'match_parent',
                  paddingHorizontal: 12,
                  paddingBottom: 8,
                }}
              >
                <FlexWidget
                  style={{
                    width: 'match_parent',
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingLeft: 20,
                    paddingRight: 16,
                    paddingVertical: 12,
                    backgroundColor: colors.bgCard,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  clickAction="OPEN_URI"
                  clickActionData={{ uri: getDeepLinkForTask(task, group) }}
                  accessibilityLabel={`${group.name}: ${task.title}`}
                >
                  <FlexWidget
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: dotColor,
                      marginRight: 12,
                    }}
                  />
                  <FlexWidget style={{ flex: 1 }}>
                    <TextWidget
                      text={truncate(task.title, 32)}
                      style={{
                        fontSize: 14,
                        fontFamily: 'Montserrat-SemiBold',
                        color: colors.text,
                      }}
                    />
                  </FlexWidget>
                </FlexWidget>
              </FlexWidget>
            ))}
          </ListWidget>
        )}
      </FlexWidget>
    </FlexWidget>
  );
}
