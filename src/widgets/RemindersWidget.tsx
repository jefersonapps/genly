'use no memo';
/** @jsxImportSource react */
import React from 'react';
import { getReminderStatus } from '../utils/reminderStatus';
import { WidgetAddIcon, WidgetIcon } from './WidgetIcon';
import { createWidgetLink } from './links';
import { FlexWidget, ListWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetTask } from './types';
import { formatWidgetDate, truncate, type WidgetThemeColors } from './theme';

interface RemindersWidgetProps {
  tasks: WidgetTask[];
  colors: WidgetThemeColors;
}

export function RemindersWidget({ tasks, colors }: RemindersWidgetProps) {
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
        <WidgetIcon reminder color={colors.text} />
        <FlexWidget style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <TextWidget
            text="Lembretes"
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
            backgroundColor: colors.accent,
            borderRadius: 12,
            width: 28,
            height: 28,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          clickAction="OPEN_URI"
          clickActionData={{ 
            uri: createWidgetLink('/task/editor', { reminderDate: (() => {
              const d = new Date();
              d.setDate(d.getDate() + 1);
              d.setHours(9, 0, 0, 0); // Default to 9 AM tomorrow
              return d.toISOString();
            })() })
          }}
        >
          <WidgetAddIcon color={colors.primary} />
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
              text="Nenhum lembrete para hoje"
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
            {tasks.map((task) => {
              const status = getReminderStatus(task.deliveryDate, task.deliveryTime, task.completed);
              return (
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
                      flexDirection: 'column',
                      paddingLeft: 20,
                      paddingRight: 16,
                      paddingVertical: 12,
                      backgroundColor: colors.bgCard,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                    clickAction="OPEN_URI"
                    clickActionData={{ uri: createWidgetLink(`/task/${task.id}`) }}
                    accessibilityLabel={`Lembrete: ${task.title}. ${status?.label || ""}`}
                  >
                    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent' }}>
                      <FlexWidget
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: colors.primary,
                          marginRight: 10,
                        }}
                      />
                      <FlexWidget style={{ flex: 1 }}>
                        <TextWidget
                          text={truncate(task.title, 40)}
                          style={{
                            fontSize: 14,
                            fontFamily: 'Montserrat-SemiBold',
                            color: colors.text,
                          }}
                        />
                      </FlexWidget>
                    </FlexWidget>
                    
                    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                      {status && <FlexWidget style={{ backgroundColor: `${status.color}20`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginRight: 8 }}>
                        <TextWidget text={status.label} style={{ fontSize: 10, fontFamily: 'Montserrat-SemiBold', color: status.color }} />
                      </FlexWidget>}
                      <FlexWidget style={{ flex: 1, alignItems: 'flex-end' }}>
                      <TextWidget
                        maxLines={1}
                        truncate="END"
                        text={formatWidgetDate(task.deliveryDate, task.deliveryTime)}
                        style={{
                          fontSize: 11,
                          fontFamily: 'Montserrat-Medium',
                          color: colors.textSecondary,
                        }}
                      />
                      </FlexWidget>
                    </FlexWidget>
                  </FlexWidget>
              </FlexWidget>
            ); })}
          </ListWidget>
        )}
      </FlexWidget>
    </FlexWidget>
  );
}
