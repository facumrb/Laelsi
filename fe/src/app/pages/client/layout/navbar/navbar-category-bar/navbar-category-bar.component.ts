import { NgTemplateOutlet } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IApiCategory } from '@models/category.model';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { bootstrapChevronDown } from '@ng-icons/bootstrap-icons';

@Component({
  selector: 'app-navbar-category-bar',
  imports: [RouterLink, RouterLinkActive, NgIconComponent, NgTemplateOutlet],
  viewProviders: [provideIcons({ bootstrapChevronDown })],
  templateUrl: './navbar-category-bar.component.html',
})
export class NavbarCategoryBarComponent {
  categories = input.required<IApiCategory[]>();
  activeCategoryIds = input.required<Set<number>>();

  isCategoryActive(categoryId: number): boolean {
    return this.activeCategoryIds().has(categoryId);
  }
}
